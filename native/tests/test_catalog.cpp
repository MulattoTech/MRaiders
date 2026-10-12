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
};
QTEST_APPLESS_MAIN(CatalogTests)
#include "test_catalog.moc"
