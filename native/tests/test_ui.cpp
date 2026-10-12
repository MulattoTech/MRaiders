#include "main_window.h"
#include <QApplication>
#include <QComboBox>
#include <QCoreApplication>
#include <QLineEdit>
#include <QPushButton>
#include <QListWidget>
#include <QTabWidget>
#include <QTreeWidget>
#include <QtTest/QtTest>

class UiTests final : public QObject {
    Q_OBJECT
private slots:
    void initTestCase() {
        QCoreApplication::setOrganizationName("MRaiders-Test");
        QCoreApplication::setApplicationName("MRaiders-UI");
    }

    void windowContainsExpectedPanelsAndMaps() {
        MainWindow window;
        auto* tabs = window.findChild<QTabWidget*>("mainTabs");
        auto* maps = window.findChild<QComboBox*>("mapChoice");
        QVERIFY(tabs != nullptr);
        QVERIFY(maps != nullptr);
        QCOMPARE(tabs->count(), 3);
        QCOMPARE(maps->count(), 7);
        QCOMPARE(maps->itemText(6), QString("Pendola Pass"));
        auto* route = window.findChild<QListWidget*>("routeList");
        QVERIFY(route != nullptr);
    }

    void filtersAndSwitchesStaticMaps() {
        MainWindow window;
        auto* maps = window.findChild<QComboBox*>("mapChoice");
        auto* search = window.findChild<QLineEdit*>("mapSearch");
        auto* markers = window.findChild<QListWidget*>("markerList");
        QVERIFY(maps && search && markers);
        maps->setCurrentIndex(0);
        QCOMPARE(markers->count(), 10);
        search->setText("Broken Bridge");
        QCOMPARE(markers->count(), 1);
        QCOMPARE(markers->item(0)->text(), QString("Broken Bridge"));
        search->clear();
        QCOMPARE(markers->count(), 10);
        maps->setCurrentIndex(6);
        QCOMPARE(markers->count(), 0); // New map data is explicitly unknown, not fabricated.
    }

    void calibrationActionsAreAvailable() {
        MainWindow window;
        QVERIFY(window.findChild<QPushButton*>("pickAnchorButton") != nullptr);
        QVERIFY(window.findChild<QPushButton*>("resetAlignmentButton") != nullptr);
    }
    void progressionChecklistIsInteractive() {
        MainWindow window;
        auto* tracker = window.findChild<QTreeWidget*>("progressionTree");
        QVERIFY(tracker != nullptr);
        QVERIFY(tracker->topLevelItemCount() >= 5);
        auto* item = tracker->topLevelItem(0);
        QVERIFY(item->flags() & Qt::ItemIsUserCheckable);
        item->setCheckState(1, Qt::Checked);
        QCOMPARE(item->checkState(1), Qt::Checked);
        item->setCheckState(1, Qt::Unchecked);
    }
};
QTEST_MAIN(UiTests)
#include "test_ui.moc"
