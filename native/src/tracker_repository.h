#pragma once
#include <QList>
#include <QString>
#include <QStringList>
#include <QByteArray>
#include <optional>

struct TrackerItem {
    QString id;
    QString group;
    QString title;
    QString detail;
};
class TrackerRepository final {
public:
    static std::optional<QList<TrackerItem>> parse(const QByteArray& bytes, QString* error = nullptr);
    static QList<TrackerItem> bundled(QStringList* errors = nullptr);
};
