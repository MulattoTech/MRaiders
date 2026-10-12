#include "catalog_store.h"
#include <QtTest/QtTest>
#include <QTemporaryDir>

class CatalogTests : public QObject {
    Q_OBJECT
private slots:
    void sqliteSchemaSearchAndPersistence() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        const QString dbPath=dir.filePath("catalog.sqlite");
        {
            CatalogStore db(dbPath);
            QString error;
            QVERIFY2(db.open(&error),qPrintable(error));
            QCOMPARE(db.schemaVersion(),1);
            QVERIFY(db.upsert({"metal","item","Metal Components","user-supplied","salvage"},&error));
            QVERIFY(db.upsert({"bp","blueprint","Test Blueprint","unverified","for test"},&error));
            QVERIFY(db.upsert({"quest1","quest","Collect Materials","user-supplied","Metal Components"},&error));
            QCOMPARE(db.search("metal").size(),2);
            QCOMPARE(db.search("","blueprint").size(),1);
            QVERIFY(db.setOwned("metal",3,&error));
            QVERIFY(db.setNeeded("metal",7,&error));
            QVERIFY(db.addRecipe("bp","metal",5,&error));
            QCOMPARE(db.recipe("bp").size(),1);
            QVERIFY(!db.addRecipe("bp","metal",-1,&error));
            QVERIFY(!db.upsert({"not valid","item","Bad","",""},&error));
            QVERIFY(!db.setNeeded("metal",-1,&error));
            QVERIFY(!db.addRecipe("bp","missing",5,&error)); // FK must reject unknown source item
        }
        {
            CatalogStore db(dbPath);
            QVERIFY(db.open());
            QCOMPARE(db.owned("metal"),3);
            QCOMPARE(db.needed("metal"),7);
            QCOMPARE(db.recipe("bp").first().second,5);
        }
    }
    void craftingPlanUsesInventoryAndRejectsCycles() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        CatalogStore db(dir.filePath("plan.sqlite"));
        QString error;
        QVERIFY2(db.open(&error), qPrintable(error));
        for (const auto& id : {"final", "middle", "raw"}) {
            QVERIFY(db.upsert({id, "item", id, "manual test", ""}, &error));
        }
        QVERIFY(db.addRecipe("final", "middle", 2, &error));
        QVERIFY(db.addRecipe("middle", "raw", 3, &error));
        QVERIFY(db.setOwned("middle", 1, &error));
        QVERIFY(db.setOwned("raw", 2, &error));
        QList<MaterialShortage> shortages;
        QVERIFY2(db.planShortages("final", 1, &shortages, &error), qPrintable(error));
        QCOMPARE(shortages.size(), 1);
        QCOMPARE(shortages[0].id, QString("raw"));
        QCOMPARE(shortages[0].missing, 1);
        QVERIFY(db.addRecipe("raw", "final", 1, &error));
        const auto previous = shortages;
        QVERIFY(!db.planShortages("final", 2, &shortages, &error));
        QVERIFY(error.contains("cycle", Qt::CaseInsensitive));
        QCOMPARE(shortages.size(), previous.size()); // failed plans never replace prior results
        QVERIFY(!db.planShortages("final", 1000001, &shortages, &error));
    }
    void portablePackRoundTripAndAtomicRollback() {
        QTemporaryDir dir;
        QVERIFY(dir.isValid());
        CatalogStore source(dir.filePath("source.sqlite"));
        CatalogStore destination(dir.filePath("destination.sqlite"));
        QString error;
        QVERIFY(source.open(&error));
        QVERIFY(destination.open(&error));
        QVERIFY(source.upsert({"widget","item","Widget","user notes","example"},&error));
        QVERIFY(source.upsert({"plate","item","Plate","user notes","material"},&error));
        QVERIFY(source.setOwned("plate",4,&error));
        QVERIFY(source.setNeeded("plate",7,&error));
        QVERIFY(source.addRecipe("widget","plate",3,&error));
        const auto pack=source.exportPackage();
        QVERIFY(!pack.isEmpty());
        QVERIFY(destination.importPackage(pack,&error));
        QCOMPARE(destination.search().size(),2);
        QCOMPARE(destination.owned("plate"),4);
        QCOMPARE(destination.needed("plate"),7);
        QCOMPARE(destination.recipe("widget").first().second,3);
        QVERIFY(!destination.importPackage(
            R"({"format":"mraiders-catalog","schema_version":2,"entries":[],"recipes":[]})",&error));
        QCOMPARE(destination.search().size(),2);
        const QByteArray broken=R"({
          "format":"mraiders-catalog",
          "schema_version":1,
          "entries":[{"id":"new","kind":"item","name":"New","source":"user","notes":""}],
          "recipes":[{"result_id":"new","ingredient_id":"missing","quantity":1}]
        })";
        QVERIFY(!destination.importPackage(broken,&error));
        QCOMPARE(destination.search("New").size(),0);
        QCOMPARE(destination.search().size(),2);
        QVERIFY(!destination.importPackage(
          R"({"format":"mraiders-catalog","schema_version":1,"entries":[{"id":"dup","kind":"item","name":"One","source":"","notes":""},{"id":"dup","kind":"item","name":"Two","source":"","notes":""}],"recipes":[]})",&error));
        QCOMPARE(destination.search().size(),2);
    }
};
QTEST_GUILESS_MAIN(CatalogTests)
#include "test_catalog.moc"
