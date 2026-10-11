#include "map_view.h"
#include <QGraphicsPixmapItem>
#include <QGraphicsScene>
#include <QPen>
#include <QWheelEvent>
#include <QPixmap>
#include <QBrush>

namespace { constexpr int canvasWidth = 1200; constexpr int canvasHeight = 800; }

MapView::MapView(QWidget* parent) : QGraphicsView(parent), scene_(this) {
    setScene(&scene_);
    setRenderHint(QPainter::Antialiasing, true);
    setDragMode(QGraphicsView::ScrollHandDrag);
    setTransformationAnchor(QGraphicsView::AnchorUnderMouse);
    setBackgroundBrush(QColor("#111d2b"));
    setFrameShape(QFrame::NoFrame);
    connect(&scene_, &QGraphicsScene::selectionChanged, this, [this] {
        for (QGraphicsItem* item : scene_.selectedItems()) {
            const QString id = item->data(0).toString();
            if (!id.isEmpty()) { emit markerActivated(id); break; }
        }
    });
}

void MapView::setMap(const MapData& map) {
    map_ = map;
    backgroundPath_.clear();
    redraw();
    resetZoom();
}
void MapView::setFilter(const QString& search, const QString& category, bool labelsVisible) {
    search_ = search.trimmed();
    category_ = category;
    labelsVisible_ = labelsVisible;
    for (const Marker& marker : map_.markers) {
        const bool match = (search_.isEmpty() ||
            marker.label.contains(search_, Qt::CaseInsensitive) ||
            marker.notes.contains(search_, Qt::CaseInsensitive)) &&
            (category_.isEmpty() || category_ == "All" ||
             marker.category.compare(category_, Qt::CaseInsensitive) == 0);
        if (circles_.contains(marker.id)) circles_.value(marker.id)->setVisible(match);
        if (labels_.contains(marker.id)) labels_.value(marker.id)->setVisible(match && labelsVisible_);
    }
}
bool MapView::setBackgroundImage(const QString& path) {
    if (!path.isEmpty()) {
        QPixmap check(path);
        if (check.isNull()) return false;
    }
    backgroundPath_ = path;
    redraw();
    return true;
}
void MapView::redraw() {
    circles_.clear();
    labels_.clear();
    scene_.clear();
    scene_.setSceneRect(0, 0, canvasWidth, canvasHeight);
    if (!backgroundPath_.isEmpty()) {
        QPixmap image(backgroundPath_);
        if (!image.isNull()) {
            auto* background = scene_.addPixmap(
                image.scaled(canvasWidth, canvasHeight, Qt::IgnoreAspectRatio, Qt::SmoothTransformation));
            background->setZValue(-2);
        }
    }
    const QPen gridPen(QColor(88, 113, 143, 65), 1);
    for (int x = 0; x <= canvasWidth; x += 100) {
        auto* line = scene_.addLine(x, 0, x, canvasHeight, gridPen);
        line->setZValue(-1);
    }
    for (int y = 0; y <= canvasHeight; y += 100) {
        auto* line = scene_.addLine(0, y, canvasWidth, y, gridPen);
        line->setZValue(-1);
    }
    for (const Marker& marker : map_.markers) {
        const qreal x = marker.x * canvasWidth;
        const qreal y = marker.y * canvasHeight;
        auto* circle = scene_.addEllipse(x - 7, y - 7, 14, 14,
                                         QPen(QColor("#101827"), 2), QBrush(map_.accent));
        circle->setFlag(QGraphicsItem::ItemIsSelectable);
        circle->setToolTip(QString("%1\n%2").arg(marker.label, marker.notes));
        circle->setData(0, marker.id);
        circle->setZValue(2);
        circles_.insert(marker.id, circle);
        auto* text = scene_.addSimpleText(marker.label);
        text->setPos(x + 12, y - 12);
        text->setBrush(QColor("#f3f8fc"));
        text->setZValue(3);
        text->setAcceptedMouseButtons(Qt::NoButton);
        labels_.insert(marker.id, text);
    }
    setFilter(search_, category_, labelsVisible_);
}
void MapView::focusMarker(const QString& id) {
    auto* circle = circles_.value(id, nullptr);
    if (!circle || !circle->isVisible()) return;
    if (!circle->isSelected()) {
        scene_.clearSelection();
        circle->setSelected(true);
    }
    centerOn(circle);
}
void MapView::resetZoom() {
    resetTransform();
    fitInView(scene_.sceneRect(), Qt::KeepAspectRatio);
}
void MapView::wheelEvent(QWheelEvent* event) {
    const qreal zoom = event->angleDelta().y() > 0 ? 1.18 : 1.0 / 1.18;
    const qreal size = transform().m11() * zoom;
    if (size >= 0.18 && size <= 15.0) scale(zoom, zoom);
    event->accept();
}
