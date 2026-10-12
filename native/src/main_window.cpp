#include "main_window.h"
#include "map_view.h"
#include <QAction>
#include <QMenu>
#include <QCheckBox>
#include <QComboBox>
#include <QFile>
#include <QFileDialog>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QHeaderView>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QLabel>
#include <QLineEdit>
#include <QListWidget>
#include <QMenuBar>
#include <QMessageBox>
#include <QPushButton>
#include <QSplitter>
#include <QStatusBar>
#include <QTabWidget>
#include <QTextBrowser>
#include <QTreeWidget>
#include <QVBoxLayout>

MainWindow::MainWindow(QWidget* parent) : QMainWindow(parent) {
    QStringList warnings;
    maps_ = MapRepository::bundled(&warnings);
    trackerItems_ = TrackerRepository::bundled(&warnings);
    setWindowTitle("MRaiders  |  ARC Raiders Companion");
    resize(1440, 900);
    setMinimumSize(900, 650);
    setStyleSheet(R"(
      QMainWindow, QWidget { background: #111926; color: #e4edf7; font-size: 13px; }
      QLineEdit, QComboBox, QListWidget, QTreeWidget, QTextBrowser {
          background: #1b293b; border: 1px solid #314458; border-radius: 6px;
          color: #e4edf7; padding: 6px; }
      QPushButton { background: #243b53; border: 1px solid #45637d;
                    border-radius: 6px; padding: 8px; color: #eaf6ff; }
      QPushButton:hover { background: #31617d; }
      QTabWidget::pane { border: 1px solid #314458; }
      QTabBar::tab { background: #1b293b; color: #e1e9f3; padding: 12px 20px; }
      QTabBar::tab:selected { background: #2b526d; }
      QGroupBox { border: 1px solid #314458; margin-top: 12px; padding-top: 10px; }
      QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 5px; }
    )");
    auto* tabs = new QTabWidget(this);
    tabs->setObjectName("mainTabs");
    tabs->addTab(createMapPage(), "Interactive Maps");
    tabs->addTab(createTrackerPage(), "My Progress");
    tabs->addTab(createUpdatePage(), "Frozen Trail 2.0");
    setCentralWidget(tabs);
    auto* fileMenu = menuBar()->addMenu("&File");
    auto* importAction = fileMenu->addAction("Import Map Image...");
    connect(importAction, &QAction::triggered, this, &MainWindow::importMapImage);
    auto* exportAction = fileMenu->addAction("Export Route...");
    connect(exportAction, &QAction::triggered, this, &MainWindow::exportRoute);
    fileMenu->addSeparator();
    connect(fileMenu->addAction("Quit"), &QAction::triggered, this, &QWidget::close);
    if (!warnings.isEmpty()) {
        statusBar()->showMessage("Data warnings: " + warnings.join(" | "));
    } else {
        statusBar()->showMessage("Offline reference app. No game integration or live capture.");
    }
    if (!maps_.isEmpty()) {
        const QString saved = settings_.value("selectedMap", maps_.front().id).toString();
        int target = 0;
        for (int i = 0; i < maps_.size(); ++i) if (maps_[i].id == saved) target = i;
        mapChoice_->setCurrentIndex(target);
        chooseMap(target);
    }
}

QWidget* MainWindow::createMapPage() {
    auto* page = new QWidget(this);
    auto* layout = new QHBoxLayout(page);
    auto* splitter = new QSplitter(Qt::Horizontal, page);
    layout->addWidget(splitter);

    auto* side = new QWidget(splitter);
    auto* sideLayout = new QVBoxLayout(side);
    auto* brand = new QLabel("<b style='font-size:22px;'>MRaiders</b><br>Independent ARC Raiders companion", side);
    brand->setTextFormat(Qt::RichText);
    sideLayout->addWidget(brand);
    sideLayout->addWidget(new QLabel("Map", side));
    mapChoice_ = new QComboBox(side);
    mapChoice_->setObjectName("mapChoice");
    for (const MapData& map : maps_) mapChoice_->addItem(map.name, map.id);
    sideLayout->addWidget(mapChoice_);
    sideLayout->addWidget(new QLabel("Search known candidate markers", side));
    search_ = new QLineEdit(side);
    search_->setObjectName("mapSearch");
    search_->setPlaceholderText("Name or notes...");
    sideLayout->addWidget(search_);
    categoryChoice_ = new QComboBox(side);
    categoryChoice_->addItem("All");
    categoryChoice_->addItem("cache");
    sideLayout->addWidget(categoryChoice_);
    showLabels_ = new QCheckBox("Show map labels", side);
    showLabels_->setChecked(settings_.value("labelsVisible", true).toBool());
    sideLayout->addWidget(showLabels_);
    auto* imageButton = new QPushButton("Load Reference Map Image", side);
    sideLayout->addWidget(imageButton);
    auto* resetButton = new QPushButton("Reset Zoom", side);
    sideLayout->addWidget(resetButton);
    mapStatus_ = new QLabel(side);
    mapStatus_->setWordWrap(true);
    sideLayout->addWidget(mapStatus_);
    sideLayout->addWidget(new QLabel("Candidate locations", side));
    markerList_ = new QListWidget(side);
    markerList_->setObjectName("markerList");
    sideLayout->addWidget(markerList_, 1);
    splitter->addWidget(side);

    view_ = new MapView(splitter);
    splitter->addWidget(view_);

    auto* routeSide = new QWidget(splitter);
    auto* routeLayout = new QVBoxLayout(routeSide);
    routeLayout->addWidget(new QLabel("<b>Manual route planner</b>", routeSide));
    detail_ = new QLabel("Select a marker to inspect it.", routeSide);
    detail_->setWordWrap(true);
    detail_->setMinimumHeight(90);
    routeLayout->addWidget(detail_);
    auto* addButton = new QPushButton("Add Selected Marker", routeSide);
    routeLayout->addWidget(addButton);
    routeList_ = new QListWidget(routeSide);
    routeList_->setObjectName("routeList");
    routeLayout->addWidget(routeList_, 1);
    auto* clearButton = new QPushButton("Clear Route", routeSide);
    routeLayout->addWidget(clearButton);
    auto* exportButton = new QPushButton("Export Route JSON", routeSide);
    routeLayout->addWidget(exportButton);
    auto* note = new QLabel("Marker coordinates are community starter candidates, not verified live spawns. "
                            "Images are user-supplied and must match the same map bounds.", routeSide);
    note->setWordWrap(true);
    routeLayout->addWidget(note);
    splitter->addWidget(routeSide);
    splitter->setSizes({260, 890, 260});

    connect(mapChoice_, &QComboBox::currentIndexChanged, this, &MainWindow::chooseMap);
    connect(categoryChoice_, &QComboBox::currentTextChanged, this, &MainWindow::refreshMarkers);
    connect(search_, &QLineEdit::textChanged, this, &MainWindow::refreshMarkers);
    connect(showLabels_, &QCheckBox::toggled, this, [this](bool checked) {
        settings_.setValue("labelsVisible", checked);
        refreshMarkers();
    });
    connect(markerList_, &QListWidget::itemClicked, this, [this](QListWidgetItem* item) {
        selectMarker(item->data(Qt::UserRole).toString());
    });
    connect(view_, &MapView::markerActivated, this, &MainWindow::selectMarker);
    connect(addButton, &QPushButton::clicked, this, &MainWindow::addWaypoint);
    connect(clearButton, &QPushButton::clicked, this, &MainWindow::clearRoute);
    connect(exportButton, &QPushButton::clicked, this, &MainWindow::exportRoute);
    connect(imageButton, &QPushButton::clicked, this, &MainWindow::importMapImage);
    connect(resetButton, &QPushButton::clicked, view_, &MapView::resetZoom);
    return page;
}

const MapData* MainWindow::activeMap() const {
    const int index = mapChoice_ ? mapChoice_->currentIndex() : -1;
    return index >= 0 && index < maps_.size() ? &maps_[index] : nullptr;
}
void MainWindow::chooseMap(int index) {
    if (index < 0 || index >= maps_.size() || !view_) return;
    const MapData& map = maps_[index];
    settings_.setValue("selectedMap", map.id);
    selectedId_.clear();
    detail_->setText("Select a marker to inspect it.");
    view_->setMap(map);
    const QString background = settings_.value("background/" + map.id).toString();
    if (!background.isEmpty() && !view_->setBackgroundImage(background))
        statusBar()->showMessage("Previously selected reference image is unavailable.");
    routeList_->clear();
    for (const QString& id : settings_.value("route/" + map.id).toStringList()) {
        for (const Marker& marker : map.markers) if (marker.id == id) {
            auto* row = new QListWidgetItem(marker.label, routeList_);
            row->setData(Qt::UserRole, id);
        }
    }
    mapStatus_->setText(QString("%1 • %2 candidate markers\nSource: %3")
        .arg(map.name).arg(map.markers.size()).arg(map.source.isEmpty() ? "Unverified" : map.source));
    refreshMarkers();
}
void MainWindow::refreshMarkers() {
    if (!view_ || !markerList_) return;
    const MapData* map = activeMap();
    if (!map) return;
    const QString query = search_->text().trimmed();
    const QString category = categoryChoice_->currentText();
    view_->setFilter(query, category, showLabels_->isChecked());
    markerList_->clear();
    for (const Marker& marker : map->markers) {
        if (!query.isEmpty() && !marker.label.contains(query, Qt::CaseInsensitive) &&
            !marker.notes.contains(query, Qt::CaseInsensitive)) continue;
        if (category != "All" && marker.category.compare(category, Qt::CaseInsensitive) != 0) continue;
        auto* row = new QListWidgetItem(marker.label, markerList_);
        row->setData(Qt::UserRole, marker.id);
        row->setToolTip(marker.notes);
    }
}
void MainWindow::selectMarker(const QString& id) {
    const MapData* map = activeMap();
    if (!map || id.isEmpty()) return;
    for (const Marker& marker : map->markers) {
        if (marker.id != id) continue;
        selectedId_ = id;
        detail_->setText(QString("<b>%1</b><br>%2<br><small>Map fractions: %3, %4</small>")
            .arg(marker.label.toHtmlEscaped(), marker.notes.toHtmlEscaped())
            .arg(marker.x, 0, 'f', 3).arg(marker.y, 0, 'f', 3));
        view_->focusMarker(id);
        for (int i = 0; i < markerList_->count(); ++i)
            if (markerList_->item(i)->data(Qt::UserRole).toString() == id) {
                markerList_->setCurrentRow(i);
                break;
            }
        break;
    }
}
void MainWindow::addWaypoint() {
    const MapData* map = activeMap();
    if (!map || selectedId_.isEmpty()) return;
    for (int i = 0; i < routeList_->count(); ++i)
        if (routeList_->item(i)->data(Qt::UserRole).toString() == selectedId_) return;
    for (const Marker& marker : map->markers) if (marker.id == selectedId_) {
        auto* item = new QListWidgetItem(marker.label, routeList_);
        item->setData(Qt::UserRole, marker.id);
        saveRoute();
        break;
    }
}
void MainWindow::saveRoute() {
    const MapData* map = activeMap();
    if (!map) return;
    QStringList list;
    for (int i = 0; i < routeList_->count(); ++i)
        list.append(routeList_->item(i)->data(Qt::UserRole).toString());
    settings_.setValue("route/" + map->id, list);
}
void MainWindow::clearRoute() {
    routeList_->clear();
    saveRoute();
}
void MainWindow::importMapImage() {
    const MapData* map = activeMap();
    if (!map) return;
    const QString path = QFileDialog::getOpenFileName(this, "Choose reference map image", QString(),
                         "Images (*.png *.jpg *.jpeg *.webp)");
    if (path.isEmpty()) return;
    if (!view_->setBackgroundImage(path)) {
        QMessageBox::warning(this, "Invalid image", "Cannot read the selected map image.");
        return;
    }
    settings_.setValue("background/" + map->id, path);
    view_->resetZoom();
}
void MainWindow::exportRoute() {
    const MapData* map = activeMap();
    if (!map) return;
    const QString path = QFileDialog::getSaveFileName(this, "Export manual route",
                         map->id + "_route.json", "JSON (*.json)");
    if (path.isEmpty()) return;
    QJsonObject root;
    root["map"] = map->id;
    root["source"] = "MRaiders manually selected, unverified candidate markers";
    QJsonArray waypoints;
    for (int i = 0; i < routeList_->count(); ++i) {
        const QString id = routeList_->item(i)->data(Qt::UserRole).toString();
        for (const Marker& m : map->markers) if (m.id == id) {
            QJsonObject point;
            point["id"] = id; point["label"] = m.label;
            point["x"] = m.x; point["y"] = m.y;
            waypoints.append(point);
            break;
        }
    }
    root["waypoints"] = waypoints;
    QFile output(path);
    if (!output.open(QIODevice::WriteOnly | QIODevice::Truncate)) {
        QMessageBox::warning(this, "Save failed", output.errorString());
        return;
    }
    output.write(QJsonDocument(root).toJson(QJsonDocument::Indented));
}
QWidget* MainWindow::createTrackerPage() {
    auto* page = new QWidget(this);
    auto* layout = new QVBoxLayout(page);
    auto* introduction = new QLabel("Offline manual checklist for Frozen Trail and general milestones. "
                                    "Not synced to Embark; no automatic progression claims.", page);
    introduction->setWordWrap(true);
    layout->addWidget(introduction);
    auto* tree = new QTreeWidget(page);
    tree->setObjectName("progressionTree");
    tree->setColumnCount(3);
    tree->setHeaderLabels({"Milestone", "Done", "Context"});
    tree->setRootIsDecorated(false);
    for (const TrackerItem& task : trackerItems_) {
        auto* item = new QTreeWidgetItem(tree, {task.title, QString(), task.group + ": " + task.detail});
        item->setData(0, Qt::UserRole, task.id);
        item->setFlags(item->flags() | Qt::ItemIsUserCheckable);
        item->setCheckState(1, settings_.value("tracker/" + task.id, false).toBool() ?
                                 Qt::Checked : Qt::Unchecked);
    }
    tree->header()->setSectionResizeMode(0, QHeaderView::ResizeToContents);
    tree->header()->setSectionResizeMode(1, QHeaderView::ResizeToContents);
    tree->header()->setSectionResizeMode(2, QHeaderView::Stretch);
    connect(tree, &QTreeWidget::itemChanged, this, [this](QTreeWidgetItem* item, int col) {
        if (col == 1) settings_.setValue("tracker/" + item->data(0, Qt::UserRole).toString(),
                                        item->checkState(1) == Qt::Checked);
    });
    layout->addWidget(tree);
    return page;
}
QWidget* MainWindow::createUpdatePage() {
    auto* page = new QWidget(this);
    auto* layout = new QVBoxLayout(page);
    auto* browser = new QTextBrowser(page);
    browser->setOpenExternalLinks(true);
    browser->setHtml(R"(<h1>Frozen Trail 2.0</h1>
       <p><b>Released October 8, 2026.</b> New map: Pendola Pass. New map conditions:
       Frigate and Redirection. New ARC: Bully, Skulker, Hydra.</p>
       <p>New Bantam and Stiletto weapons; Amplified Weapons, revamped skills, Outpost
       and Research Station, 100 Furniture Designs, 14 Weapon Stencils and Reward Pass.</p>
       <p>This is an informational snapshot, not a live game-data feed.
       <a href="https://id.embark.games/arc-raiders/support/faq/282-2-0-frozen-trail-update">
       Official Embark release notes</a>.</p>
       <p><b>Independence:</b> MRaiders is an unofficial fan-made project and is not
       affiliated with, sponsored by, or endorsed by Embark Studios. All game
       trademarks and assets remain their respective owners' property.</p>)");
    layout->addWidget(browser);
    return page;
}
