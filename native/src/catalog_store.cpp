#include "catalog_store.h"
#include <QSqlError>
#include <QSqlQuery>
#include <QUuid>
#include <QVariant>
#include <QMap>
#include <functional>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QSet>

namespace {
bool fail(QString* error, const QString& reason) {
    if (error) *error = reason;
    return false;
}
bool validId(const QString& id) {
    if (id.isEmpty() || id.size() > 100) return false;
    for (const QChar c : id) {
        if (!(c.isLetterOrNumber() || c == '-' || c == '_' || c == ':')) return false;
    }
    return true;
}
}

CatalogStore::CatalogStore(const QString& databasePath) {
    connectionName_ = QString("mraiders-catalog-%1").arg(QUuid::createUuid().toString(QUuid::WithoutBraces));
    db_ = QSqlDatabase::addDatabase("QSQLITE", connectionName_);
    db_.setDatabaseName(databasePath);
}

CatalogStore::~CatalogStore() {
    db_.close();
    db_ = QSqlDatabase();
    QSqlDatabase::removeDatabase(connectionName_);
}

bool CatalogStore::open(QString* error) {
    if (!db_.open()) return fail(error, db_.lastError().text());
    QSqlQuery pragma(db_);
    if (!pragma.exec("PRAGMA foreign_keys=ON")) return fail(error, pragma.lastError().text());
    return execSchema(error);
}

bool CatalogStore::execSchema(QString* error) {
    if (!db_.transaction()) return fail(error, db_.lastError().text());
    const QStringList statements = {
        "CREATE TABLE IF NOT EXISTS catalog_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        "CREATE TABLE IF NOT EXISTS catalog_entries (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('item','blueprint','quest')), name TEXT NOT NULL, source TEXT NOT NULL, notes TEXT NOT NULL)",
        "CREATE INDEX IF NOT EXISTS idx_catalog_kind_name ON catalog_entries(kind, name)",
        "CREATE TABLE IF NOT EXISTS catalog_recipes (result_id TEXT NOT NULL REFERENCES catalog_entries(id) ON DELETE CASCADE, ingredient_id TEXT NOT NULL REFERENCES catalog_entries(id), quantity INTEGER NOT NULL CHECK(quantity > 0), PRIMARY KEY(result_id, ingredient_id))",
        "CREATE TABLE IF NOT EXISTS catalog_needed (entry_id TEXT PRIMARY KEY REFERENCES catalog_entries(id) ON DELETE CASCADE, quantity INTEGER NOT NULL CHECK(quantity >= 0))",
        "CREATE TABLE IF NOT EXISTS catalog_owned (entry_id TEXT PRIMARY KEY REFERENCES catalog_entries(id) ON DELETE CASCADE, quantity INTEGER NOT NULL CHECK(quantity >= 0))",
        "INSERT OR IGNORE INTO catalog_meta(key,value) VALUES('schema_version','1')"
    };
    for (const auto& sql : statements) {
        QSqlQuery q(db_);
        if (!q.exec(sql)) {
            db_.rollback();
            return fail(error, q.lastError().text());
        }
    }
    if (!db_.commit()) return fail(error, db_.lastError().text());
    return true;
}

int CatalogStore::schemaVersion() const {
    QSqlQuery q(db_);
    if (!q.exec("SELECT value FROM catalog_meta WHERE key='schema_version'") || !q.next()) return -1;
    return q.value(0).toInt();
}

bool CatalogStore::upsert(const CatalogEntry& entry, QString* error) {
    if (!validId(entry.id) || entry.name.trimmed().isEmpty() ||
        (entry.kind != "item" && entry.kind != "blueprint" && entry.kind != "quest"))
        return fail(error, "Invalid entry ID, kind, or name");
    QSqlQuery q(db_);
    q.prepare("INSERT INTO catalog_entries(id,kind,name,source,notes) VALUES(?,?,?,?,?) "
              "ON CONFLICT(id) DO UPDATE SET kind=excluded.kind,name=excluded.name,source=excluded.source,notes=excluded.notes");
    q.addBindValue(entry.id);
    q.addBindValue(entry.kind);
    q.addBindValue(entry.name.trimmed());
    q.addBindValue(entry.source);
    q.addBindValue(entry.notes);
    if (!q.exec()) return fail(error, q.lastError().text());
    return true;
}

QList<CatalogEntry> CatalogStore::search(const QString& query, const QString& kind) const {
    QList<CatalogEntry> found;
    QSqlQuery q(db_);
    QString statement = "SELECT id,kind,name,source,notes FROM catalog_entries WHERE 1=1";
    if (!kind.isEmpty()) statement += " AND kind=:kind";
    if (!query.isEmpty()) statement += " AND (instr(lower(name),lower(:name))>0 OR instr(lower(notes),lower(:notes))>0)";
    statement += " ORDER BY name COLLATE NOCASE,id LIMIT 500";
    if (!q.prepare(statement)) return found;
    if (!kind.isEmpty()) q.bindValue(":kind",kind);
    if (!query.isEmpty()) {
        q.bindValue(":name",query);
        q.bindValue(":notes",query);
    }
    if (!q.exec()) return found;
    while (q.next()) found.append({q.value(0).toString(), q.value(1).toString(),
                                     q.value(2).toString(), q.value(3).toString(),
                                     q.value(4).toString()});
    return found;
}

bool CatalogStore::addRecipe(const QString& resultId, const QString& ingredientId, int quantity, QString* error) {
    if (quantity <= 0 || resultId == ingredientId || !validId(resultId) || !validId(ingredientId))
        return fail(error, "Invalid recipe");
    QSqlQuery q(db_);
    q.prepare("INSERT INTO catalog_recipes(result_id,ingredient_id,quantity) VALUES(?,?,?) "
              "ON CONFLICT(result_id,ingredient_id) DO UPDATE SET quantity=excluded.quantity");
    q.addBindValue(resultId);q.addBindValue(ingredientId);q.addBindValue(quantity);
    if (!q.exec()) return fail(error, q.lastError().text());
    return true;
}

QList<QPair<QString,int>> CatalogStore::recipe(const QString& resultId) const {
    QList<QPair<QString,int>> rows;
    QSqlQuery q(db_);
    q.prepare("SELECT ingredient_id,quantity FROM catalog_recipes WHERE result_id=? ORDER BY ingredient_id");
    q.addBindValue(resultId);
    if (q.exec()) while(q.next()) rows.append({q.value(0).toString(),q.value(1).toInt()});
    return rows;
}

bool CatalogStore::planShortages(const QString& root, int amount,
                                 QList<MaterialShortage>* shortages, QString* error) const {
    if (!shortages || !validId(root) || amount <= 0 || amount > 1000000)
        return fail(error, "Invalid planning request");
    QMap<QString, qint64> missing;
    QMap<QString, qint64> consumed;
    QStringList stack;
    int visits = 0;
    std::function<bool(const QString&, qint64)> expand = [&](const QString& id, qint64 count) -> bool {
        if (++visits > 1000 || count > 1000000)
            return fail(error, "Recipe graph exceeds safe limits");
        if (stack.contains(id))
            return fail(error, "Recipe cycle: " + (stack + QStringList{id}).join(" -> "));
        stack.append(id);
        const qint64 available = qMax(qint64(0), qint64(owned(id)) - consumed.value(id));
        const qint64 take = qMin(available, count);
        consumed[id] += take;
        const qint64 required = count - take;
        if (required > 0) {
            const auto ingredients = recipe(id);
            if (ingredients.isEmpty()) {
                missing[id] += required;
            } else {
                for (const auto& part : ingredients) {
                    if (required > 1000000 / part.second ||
                        !expand(part.first, required * part.second)) {
                        stack.removeLast();
                        return fail(error, error && !error->isEmpty() ? *error : "Recipe amount overflow");
                    }
                }
            }
        }
        stack.removeLast();
        return true;
    };
    if (!expand(root, amount)) return false;
    QList<MaterialShortage> result;
    for (auto it = missing.cbegin(); it != missing.cend(); ++it) {
        if (it.value() > 1000000) return fail(error, "Shortage amount overflow");
        result.append({it.key(), int(it.value())});
    }
    *shortages = result;
    if (error) error->clear();
    return true;
}

QByteArray CatalogStore::exportPackage() const {
    QJsonArray entries, recipes;
    QSqlQuery e(db_);
    if (!e.exec("SELECT id,kind,name,source,notes FROM catalog_entries ORDER BY id"))
        return {};
    while (e.next()) {
        const QString id=e.value(0).toString();
        QJsonObject row;
        row["id"]=id;
        row["kind"]=e.value(1).toString();
        row["name"]=e.value(2).toString();
        row["source"]=e.value(3).toString();
        row["notes"]=e.value(4).toString();
        row["owned"]=owned(id);
        row["needed"]=needed(id);
        entries.append(row);
    }
    QSqlQuery r(db_);
    if (!r.exec("SELECT result_id,ingredient_id,quantity FROM catalog_recipes ORDER BY result_id,ingredient_id"))
        return {};
    while (r.next()) {
        QJsonObject row;
        row["result_id"]=r.value(0).toString();
        row["ingredient_id"]=r.value(1).toString();
        row["quantity"]=r.value(2).toInt();
        recipes.append(row);
    }
    QJsonObject root;
    root["format"]="mraiders-catalog";
    root["schema_version"]=1;
    root["entries"]=entries;
    root["recipes"]=recipes;
    return QJsonDocument(root).toJson(QJsonDocument::Indented);
}

bool CatalogStore::importPackage(const QByteArray& bytes, QString* error) {
    constexpr int maxBytes=2*1024*1024;
    if (bytes.isEmpty() || bytes.size()>maxBytes)
        return fail(error, "Catalog package must be between 1 byte and 2 MiB");
    QJsonParseError parseError;
    const QJsonDocument document=QJsonDocument::fromJson(bytes,&parseError);
    if (parseError.error!=QJsonParseError::NoError || !document.isObject())
        return fail(error,"Invalid JSON object: "+parseError.errorString());
    const QJsonObject root=document.object();
    if (root.value("format").toString()!="mraiders-catalog" ||
        root.value("schema_version").toInt(-1)!=1 ||
        !root.value("entries").isArray() || !root.value("recipes").isArray())
        return fail(error,"Unsupported catalog format or schema version");
    const auto entries=root.value("entries").toArray();
    const auto recipes=root.value("recipes").toArray();
    if (entries.size()>5000 || recipes.size()>20000)
        return fail(error,"Catalog package exceeds record limits");
    QSet<QString> ids, recipeKeys;
    for (const auto& v: entries) {
        if (!v.isObject()) return fail(error,"Malformed catalog entry");
        const auto e=v.toObject();
        const QString id=e.value("id").toString();
        const QString kind=e.value("kind").toString();
        const QString name=e.value("name").toString();
        if (!validId(id) || ids.contains(id) ||
            (kind!="item" && kind!="blueprint" && kind!="quest") ||
            name.trimmed().isEmpty() || name.size()>256 ||
            !e.value("source").isString() || !e.value("notes").isString() ||
            e.value("source").toString().size()>2048 ||
            e.value("notes").toString().size()>4096)
            return fail(error,"Invalid or duplicate catalog entry");
        for(const QString& field: {"owned","needed"}) {
            if (e.contains(field) &&
                (!e.value(field).isDouble() || e.value(field).toDouble()<0 ||
                 e.value(field).toDouble()>1000000 ||
                 e.value(field).toDouble()!=int(e.value(field).toDouble())))
                return fail(error,"Invalid quantity in catalog entry");
        }
        ids.insert(id);
    }
    for (const auto& v: recipes) {
        if (!v.isObject()) return fail(error,"Malformed recipe");
        const auto e=v.toObject();
        const QString result=e.value("result_id").toString();
        const QString ingredient=e.value("ingredient_id").toString();
        const QString key=result+QString(QChar(0))+ingredient;
        if (!validId(result) || !validId(ingredient) || result==ingredient ||
            recipeKeys.contains(key) || !e.value("quantity").isDouble() ||
            e.value("quantity").toDouble()<1 || e.value("quantity").toDouble()>100000 ||
            e.value("quantity").toDouble()!=int(e.value("quantity").toDouble()))
            return fail(error,"Invalid or duplicate recipe");
        recipeKeys.insert(key);
    }
    if (!db_.transaction()) return fail(error,db_.lastError().text());
    QString failure;
    for (const auto& v:entries) {
        const auto e=v.toObject();
        CatalogEntry entry{e.value("id").toString(),e.value("kind").toString(),
                           e.value("name").toString(),e.value("source").toString(),
                           e.value("notes").toString()};
        if (!upsert(entry,&failure) ||
            (e.contains("owned") && !setOwned(entry.id,e.value("owned").toInt(),&failure)) ||
            (e.contains("needed") && !setNeeded(entry.id,e.value("needed").toInt(),&failure))) {
            db_.rollback();
            return fail(error,"Import rolled back: "+failure);
        }
    }
    for (const auto& v:recipes) {
        const auto e=v.toObject();
        if (!addRecipe(e.value("result_id").toString(),
                       e.value("ingredient_id").toString(),
                       e.value("quantity").toInt(),&failure)) {
            db_.rollback();
            return fail(error,"Import rolled back: "+failure);
        }
    }
    if (!db_.commit()) {
        db_.rollback();
        return fail(error,"Import commit failed: "+db_.lastError().text());
    }
    if (error) error->clear();
    return true;
}

bool CatalogStore::countSet(const QString& table, const QString& id, int count, QString* error) {
    if (count < 0 || !validId(id)) return fail(error, "Invalid count or ID");
    const QString sql = QString("INSERT INTO %1(entry_id,quantity) VALUES(?,?) "
        "ON CONFLICT(entry_id) DO UPDATE SET quantity=excluded.quantity").arg(table);
    QSqlQuery q(db_);q.prepare(sql);q.addBindValue(id);q.addBindValue(count);
    if (!q.exec()) return fail(error, q.lastError().text());
    return true;
}
int CatalogStore::countGet(const QString& table,const QString& id) const {
    QSqlQuery q(db_);q.prepare(QString("SELECT quantity FROM %1 WHERE entry_id=?").arg(table));
    q.addBindValue(id);
    return q.exec() && q.next() ? q.value(0).toInt() : 0;
}
bool CatalogStore::setNeeded(const QString& id,int n,QString* e) { return countSet("catalog_needed",id,n,e); }
int CatalogStore::needed(const QString& id) const { return countGet("catalog_needed",id); }
bool CatalogStore::setOwned(const QString& id,int n,QString* e) { return countSet("catalog_owned",id,n,e); }
int CatalogStore::owned(const QString& id) const { return countGet("catalog_owned",id); }
