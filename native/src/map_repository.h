#pragma once
#include <QColor>
#include <QList>
#include <QString>
#include <QStringList>
#include <QByteArray>
#include <optional>

struct Marker {
    QString id;
    QString label;
    QString notes;
    QString category;
    double x = 0.0;
    double y = 0.0;
};

struct MapData {
    QString id;
    QString name;
    QString description;
    QString source;
    QString updatedAt;
    QColor accent;
    QList<Marker> markers;
};

class MapRepository final {
public:
    static std::optional<MapData> parse(const QByteArray& data, const QString& id, QString* error = nullptr);
    static QList<MapData> bundled(QStringList* errors = nullptr);
};
