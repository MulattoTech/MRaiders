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
#include <QInputDialog>
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
    auto* pickAnchorButton = new QPushButton("Align Selected Marker to Image...", side);
    pickAnchorButton->setObjectName("pickAnchorButton");
    sideLayout->addWidget(pickAnchorButton);
    auto* resetAlignmentButton = new QPushButton("Reset Map Alignment", side);
    resetAlignmentButton->setObjectName("resetAlignmentButton");
    sideLayout->addWidget(resetAlignmentButton);
    auto* manualAnchorButton = new QPushButton("Pick Independent Map Coordinate...", side);
    manualAnchorButton->setObjectName("manualAnchorButton");
    sideLayout->addWidget(manualAnchorButton);
    auto* importAlignmentButton = new QPushButton("Import Alignment JSON...", side);
    importAlignmentButton->setObjectName("importAlignmentButton");
    sideLayout->addWidget(importAlignmentButton);
    auto* exportAlignmentButton = new QPushButton("Export Alignment JSON...", side);
    exportAlignmentButton->setObjectName("exportAlignmentButton");
    sideLayout->addWidget(exportAlignmentButton);
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
    connect(pickAnchorButton, &QPushButton::clicked, this, &MainWindow::startCalibrationPick);
    connect(manualAnchorButton, &QPushButton::clicked, this, &MainWindow::startManualCalibrationPick);
    connect(importAlignmentButton, &QPushButton::clicked, this, &MainWindow::importCalibration);
    connect(exportAlignmentButton, &QPushButton::clicked, this, &MainWindow::exportCalibration);
    connect(resetAlignmentButton, &QPushButton::clicked, this, &MainWindow::clearCalibration);
    connect(view_, &MapView::calibrationPointPicked, this, &MainWindow::finishCalibrationPick);
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
    calibrationAnchors_.clear();
    const QString background = settings_.value("background/" + map.id).toString();
    if (!background.isEmpty() && !view_->setBackgroundImage(background))
        statusBar()->showMessage("Previously selected reference image is unavailable.");
    restoreCalibration(map.id);
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
    const QString previous = settings_.value("background/" + map->id).toString();
    settings_.setValue("background/" + map->id, path);
    if (previous != path) {
        calibrationAnchors_.clear();
        settings_.remove("calibration/" + map->id);
        view_->setCalibration(QTransform());
        statusBar()->showMessage("Reference changed; alignment reset. Re-pick anchors.", 7000);
    }
    view_->resetZoom();
}
void MainWindow::restoreCalibration(const QString& mapId) {
    const QByteArray saved = settings_.value("calibration/" + mapId).toByteArray();
    if (saved.isEmpty()) return;
    QString error;
    const auto anchors = Calibration::decode(saved, &error);
    if (!anchors) {
        statusBar()->showMessage("Stored alignment invalid: " + error, 10000);
        return;
    }
    const auto matrix = Calibration::fit(*anchors, &error);
    if (!matrix) {
        statusBar()->showMessage("Stored alignment could not be fitted: " + error, 10000);
        return;
    }
    calibrationAnchors_ = *anchors;
    view_->setCalibration(*matrix);
}

void MainWindow::startCalibrationPick() {
    const MapData* map = activeMap();
    if (!map || selectedId_.isEmpty()) {
        QMessageBox::information(this, "Choose a reference",
            "First select a marker with a known location on your reference image.");
        return;
    }
    if (!view_->hasReferenceImage()) {
        QMessageBox::information(this, "Import an image",
            "Load a reference map image before selecting alignment anchors.");
        return;
    }
    if (calibrationAnchors_.size() >= 3) {
        QMessageBox::information(this, "Three anchors reached",
            "Reset alignment to start a new anchor set.");
        return;
    }
    for (const Marker& marker : map->markers) {
        if (marker.id != selectedId_) continue;
        pendingMapAnchor_ = QPointF(marker.x, marker.y);
        view_->beginCalibrationPick();
        statusBar()->showMessage(
            "Click the selected landmark's position on the imported map. "
            "Right-click to cancel. Markers are unverified candidates.", 15000);
        return;
    }
}

void MainWindow::startManualCalibrationPick() {
    const MapData* map = activeMap();
    if (!map) return;
    if (!view_->hasReferenceImage()) {
        QMessageBox::information(this, "Import an image",
            "Load your own reference map image first.");
        return;
    }
    if (calibrationAnchors_.size() >= 3) {
        QMessageBox::information(this, "Three anchors reached",
            "Reset alignment to start a new anchor set.");
        return;
    }
    bool accepted = false;
    const double x = QInputDialog::getDouble(this, "Known logical point",
        "Known map X fraction (0..1)", 0.5, 0.0, 1.0, 6, &accepted);
    if (!accepted) return;
    const double y = QInputDialog::getDouble(this, "Known logical point",
        "Known map Y fraction (0..1)", 0.5, 0.0, 1.0, 6, &accepted);
    if (!accepted) return;
    pendingMapAnchor_ = QPointF(x, y);
    view_->beginCalibrationPick();
    statusBar()->showMessage(
        "Click the corresponding point on your reference image; right-click cancels.", 15000);
}

void MainWindow::importCalibration() {
    const MapData* map = activeMap();
    if (!map) return;
    if (!view_->hasReferenceImage()) {
        QMessageBox::information(this, "Import an image",
            "Load the reference image before importing its alignment.");
        return;
    }
    const QString path = QFileDialog::getOpenFileName(this,
        "Import MRaiders alignment", QString(), "JSON (*.json)");
    if (path.isEmpty()) return;
    QFile input(path);
    if (!input.open(QIODevice::ReadOnly) || input.size() > 65536) {
        QMessageBox::warning(this, "Invalid file", "Could not open alignment or file is too large.");
        return;
    }
    const QByteArray contents = input.readAll();
    const QJsonDocument document = QJsonDocument::fromJson(contents);
    if (!document.isObject() ||
        document.object().value("mapId").toString() != map->id) {
        QMessageBox::warning(this, "Wrong map",
            "Alignment JSON must contain this exact mapId.");
        return;
    }
    QString error;
    const auto anchors = Calibration::decode(contents, &error);
    if (!anchors) {
        QMessageBox::warning(this, "Invalid alignment", error);
        return;
    }
    const auto matrix = Calibration::fit(*anchors, &error);
    if (!matrix) {
        QMessageBox::warning(this, "Cannot align", error);
        return;
    }
    calibrationAnchors_ = *anchors;
    view_->setCalibration(*matrix);
    settings_.setValue("calibration/" + map->id, Calibration::encode(*anchors));
    statusBar()->showMessage("Imported and validated alignment for " + map->name, 9000);
}

void MainWindow::exportCalibration() {
    const MapData* map = activeMap();
    if (!map || calibrationAnchors_.size() < 2) {
        QMessageBox::information(this, "No saved alignment",
            "Create a valid alignment with two or three anchors first.");
        return;
    }
    const QString path = QFileDialog::getSaveFileName(this,
        "Export MRaiders alignment", map->id + "_alignment.json", "JSON (*.json)");
    if (path.isEmpty()) return;
    QJsonObject data = QJsonDocument::fromJson(
        Calibration::encode(calibrationAnchors_)).object();
    data["mapId"] = map->id;
    data["verification"] = "user_supplied_unverified";
    data["reference"] = "User-owned reference map image (not included)";
    const QByteArray output = QJsonDocument(data).toJson(QJsonDocument::Indented);
    QFile file(path);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Truncate) ||
        file.write(output) != output.size()) {
        QMessageBox::warning(this, "Export failed", file.errorString());
        return;
    }
    statusBar()->showMessage("Alignment exported (no image or game data included).", 8000);
}

void MainWindow::finishCalibrationPick(const QPointF& imagePoint) {
    const MapData* map = activeMap();
    if (!map) return;
    QVector<CalibrationAnchor> candidate = calibrationAnchors_;
    candidate.append({pendingMapAnchor_, imagePoint});
    if (candidate.size() == 1) {
        calibrationAnchors_ = candidate;
        statusBar()->showMessage("First anchor captured. Pick a second distinct marker.", 10000);
        return;
    }
    QString error;
    const auto transform = Calibration::fit(candidate, &error);
    if (!transform) {
        QMessageBox::warning(this, "Cannot align reference", error);
        return; // Preserve last known-good transform and anchor set.
    }
    calibrationAnchors_ = candidate;
    view_->setCalibration(*transform);
    settings_.setValue("calibration/" + map->id, Calibration::encode(candidate));
    statusBar()->showMessage(QString("%1-anchor map alignment saved for %2.")
                              .arg(candidate.size()).arg(map->name), 9000);
}

void MainWindow::clearCalibration() {
    const MapData* map = activeMap();
    if (!map) return;
    calibrationAnchors_.clear();
    settings_.remove("calibration/" + map->id);
    view_->setCalibration(QTransform());
    statusBar()->showMessage("Map alignment reset to identity.", 6000);
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
