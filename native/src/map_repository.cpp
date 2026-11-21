#include "map_repository.h"
#include <QFile>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSet>

std::optional<MapData> MapRepository::parse(const QByteArray& bytes, const QString& id, QString* error) {
    auto fail = [&](const QString& message) -> std::optional<MapData> {
        if (error) *error = message;
        return std::nullopt;
    };
    QJsonParseError parseError;
    const QJsonDocument document = QJsonDocument::fromJson(bytes, &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject())
        return fail(QStringLiteral("Invalid JSON object: %1").arg(parseError.errorString()));
    const QJsonObject root = document.object();
    if (!root.value("name").isString() || !root.value("spawns").isArray())
        return fail(QStringLiteral("A map requires name and spawns array"));
    MapData map;
    map.id = id;
    map.name = root.value("name").toString();
    map.description = root.value("description").toString();
    map.source = root.value("source").toString();
    map.updatedAt = root.value("updatedAt").toString();
    map.accent = QColor(root.value("accentColor").toString("#55d6cd"));
    if (!map.accent.isValid()) map.accent = QColor("#55d6cd");
    QSet<QString> ids;
    for (const QJsonValue value : root.value("spawns").toArray()) {
        if (!value.isObject()) return fail("Each spawn must be an object");
        const QJsonObject point = value.toObject();
        Marker marker;
        marker.id = point.value("id").toVariant().toString();
        marker.label = point.value("label").toString(marker.id);
        marker.notes = point.value("notes").toString();
        marker.category = point.value("category").toString("cache");
        if (marker.id.isEmpty() || ids.contains(marker.id) ||
            !point.value("x").isDouble() || !point.value("y").isDouble())
            return fail(QStringLiteral("Invalid or duplicate marker ID/coordinates"));
        marker.x = point.value("x").toDouble();
        marker.y = point.value("y").toDouble();
        if (marker.x < 0 || marker.x > 1 || marker.y < 0 || marker.y > 1)
            return fail(QStringLiteral("Marker %1 must use normalized 0..1 coordinates").arg(marker.id));
        ids.insert(marker.id);
        map.markers.append(marker);
    }
    if (error) error->clear();
    return map;
}

QList<MapData> MapRepository::bundled(QStringList* errors) {
    const QStringList ids = {"dam_battlegrounds", "blue_gate", "buried_city", "spaceport",
                             "stella_montis", "riven_tides", "pendola_pass"};
    QList<MapData> maps;
    for (const QString& id : ids) {
        QFile file(QString(":/data/%1_caches.json").arg(id));
        if (!file.open(QIODevice::ReadOnly)) {
            if (errors) errors->append(QString("%1: resource missing").arg(id));
            continue;
        }
        QString error;
        auto map = parse(file.readAll(), id, &error);
        if (map) maps.append(*map);
        else if (errors) errors->append(QString("%1: %2").arg(id, error));
    }
    return maps;
}
