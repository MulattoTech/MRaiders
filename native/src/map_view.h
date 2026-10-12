#pragma once
#include "map_repository.h"
#include <QTransform>
#include <QGraphicsView>
#include <QGraphicsScene>
#include <QGraphicsEllipseItem>
#include <QGraphicsSimpleTextItem>
#include <QMap>

class MapView final : public QGraphicsView {
    Q_OBJECT
public:
    explicit MapView(QWidget* parent = nullptr);
    void setMap(const MapData& map);
    void setFilter(const QString& search, const QString& category, bool labelsVisible);
    bool setBackgroundImage(const QString& path);
    void focusMarker(const QString& id);
    void setCalibration(const QTransform& matrix);
    void beginCalibrationPick();
    bool hasReferenceImage() const { return !backgroundPath_.isEmpty(); }
    void resetZoom();
signals:
    void markerActivated(const QString& id);
    void calibrationPointPicked(const QPointF& normalizedImagePoint);
protected:
    void wheelEvent(QWheelEvent* event) override;
    void mousePressEvent(QMouseEvent* event) override;
private:
    void redraw();
    QGraphicsScene scene_;
    MapData map_;
    QString search_;
    QString category_;
    bool labelsVisible_ = true;
    QString backgroundPath_;
    QTransform calibration_;
    bool calibrationPickActive_ = false;
    QMap<QString, QGraphicsEllipseItem*> circles_;
    QMap<QString, QGraphicsSimpleTextItem*> labels_;
};
