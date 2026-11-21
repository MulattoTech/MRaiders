#include "tracker_repository.h"
#include <QFile>
#include <QJsonDocument>
#include <QJsonArray>
#include <QJsonObject>
#include <QSet>

std::optional<QList<TrackerItem>> TrackerRepository::parse(const QByteArray& bytes, QString* error) {
    auto fail = [&](const QString& detail) -> std::optional<QList<TrackerItem>> {
        if (error) *error = detail;
        return std::nullopt;
    };
    QJsonParseError jsonError;
    QJsonDocument document = QJsonDocument::fromJson(bytes, &jsonError);
    if (jsonError.error != QJsonParseError::NoError || !document.isObject() ||
        !document.object().value("items").isArray()) return fail("Expected JSON object with items array");
    QList<TrackerItem> items;
    QSet<QString> ids;
    for (const QJsonValue entry : document.object().value("items").toArray()) {
        if (!entry.isObject()) return fail("Invalid task object");
        QJsonObject item = entry.toObject();
        const QString id = item.value("id").toString();
        const QString title = item.value("title").toString();
        if (id.isEmpty() || title.isEmpty() || ids.contains(id)) return fail("Task IDs and titles must be unique/non-empty");
        ids.insert(id);
        items.append({id, item.value("group").toString("General"), title, item.value("detail").toString()});
    }
    if (error) error->clear();
    return items;
}
QList<TrackerItem> TrackerRepository::bundled(QStringList* errors) {
    QFile file(":/data/progression.json");
    if (!file.open(QIODevice::ReadOnly)) {
        if (errors) errors->append("progression.json resource missing");
        return {};
    }
    QString error;
    auto tasks = parse(file.readAll(), &error);
    if (!tasks) {
        if (errors) errors->append(error);
        return {};
    }
    return *tasks;
}
