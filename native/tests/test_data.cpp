#include "map_repository.h"
#include "tracker_repository.h"
#include <QtTest/QtTest>

class DataTests : public QObject {
    Q_OBJECT
private slots:
    void bundledMapsAreValid() {
        QStringList errors;
        const auto maps = MapRepository::bundled(&errors);
        QVERIFY2(errors.isEmpty(), qPrintable(errors.join("; ")));
        QCOMPARE(maps.size(), 7);
        QCOMPARE(maps.last().id, QString("pendola_pass"));
        for (const auto& map : maps) QVERIFY(!map.name.isEmpty());
    }
    void rejectsOutOfRange() {
        QString error;
        auto map = MapRepository::parse(R"({"name":"bad","spawns":[{"id":"a","x":1.5,"y":0.3}]})", "bad", &error);
        QVERIFY(!map.has_value());
        QVERIFY(error.contains("normalized"));
    }
    void rejectsDuplicateMarkerIds() {
        QString error;
        auto map = MapRepository::parse(R"({"name":"bad","spawns":[{"id":"same","x":0.1,"y":0.1},{"id":"same","x":0.2,"y":0.2}]})", "bad", &error);
        QVERIFY(!map.has_value());
    }
    void acceptsEmptyMap() {
        auto map = MapRepository::parse(R"({"name":"New","spawns":[]})", "new");
        QVERIFY(map.has_value());
        QCOMPARE(map->markers.size(), 0);
    }
    void bundledTrackerIsValid() {
        QStringList errors;
        auto items = TrackerRepository::bundled(&errors);
        QVERIFY2(errors.isEmpty(), qPrintable(errors.join("; ")));
        QVERIFY(items.size() >= 5);
    }
    void rejectsMalformedTracker() {
        QVERIFY(!TrackerRepository::parse(R"({"items":[{"id":"x","title":"One"},{"id":"x","title":"Two"}]})").has_value());
    }
};
QTEST_APPLESS_MAIN(DataTests)
#include "test_data.moc"
