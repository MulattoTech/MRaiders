#pragma once
#include "map_repository.h"
#include "tracker_repository.h"
#include "calibration.h"
#include <QMainWindow>
#include <QSettings>
#include <QList>
class QComboBox;
class QLineEdit;
class QListWidget;
class QCheckBox;
class QTreeWidget;
class QLabel;
class MapView;

class MainWindow final : public QMainWindow {
    Q_OBJECT
public:
    explicit MainWindow(QWidget* parent = nullptr);
private:
    QWidget* createMapPage();
    QWidget* createTrackerPage();
    QWidget* createUpdatePage();
    void chooseMap(int index);
    void refreshMarkers();
    void selectMarker(const QString& id);
    void addWaypoint();
    void clearRoute();
    void saveRoute();
    void importMapImage();
    void exportRoute();
    void startCalibrationPick();
    void startManualCalibrationPick();
    void importCalibration();
    void exportCalibration();
    void finishCalibrationPick(const QPointF& imagePoint);
    void clearCalibration();
    void restoreCalibration(const QString& mapId);
    const MapData* activeMap() const;
    QList<MapData> maps_;
    QList<TrackerItem> trackerItems_;
    QSettings settings_;
    QComboBox* mapChoice_ = nullptr;
    QComboBox* categoryChoice_ = nullptr;
    QLineEdit* search_ = nullptr;
    QCheckBox* showLabels_ = nullptr;
    QListWidget* markerList_ = nullptr;
    QListWidget* routeList_ = nullptr;
    QLabel* detail_ = nullptr;
    QLabel* mapStatus_ = nullptr;
    MapView* view_ = nullptr;
    QString selectedId_;
    QVector<CalibrationAnchor> calibrationAnchors_;
    QPointF pendingMapAnchor_;
};
