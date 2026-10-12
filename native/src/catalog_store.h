#pragma once
#include <QList>
#include <QString>
#include <QSqlDatabase>

struct CatalogEntry {
    QString id;
    QString kind;
    QString name;
    QString source;
    QString notes;
};

class CatalogStore {
public:
    explicit CatalogStore(const QString& databasePath);
    ~CatalogStore();
    CatalogStore(const CatalogStore&) = delete;
    CatalogStore& operator=(const CatalogStore&) = delete;
    bool open(QString* error = nullptr);
    bool upsert(const CatalogEntry& entry, QString* error = nullptr);
    QList<CatalogEntry> search(const QString& query = {}, const QString& kind = {}) const;
    bool addRecipe(const QString& resultId, const QString& ingredientId, int quantity, QString* error = nullptr);
    QList<QPair<QString, int>> recipe(const QString& resultId) const;
    bool setNeeded(const QString& id, int quantity, QString* error = nullptr);
    int needed(const QString& id) const;
    bool setOwned(const QString& id, int quantity, QString* error = nullptr);
    int owned(const QString& id) const;
    int schemaVersion() const;
private:
    QString connectionName_;
    QSqlDatabase db_;
    bool execSchema(QString* error);
    bool countSet(const QString& table, const QString& id, int count, QString* error);
    int countGet(const QString& table, const QString& id) const;
};
