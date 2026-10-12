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
};
QTEST_GUILESS_MAIN(CatalogTests)
#include "test_catalog.moc"
