#pragma once
#include <QByteArray>
#include <QPointF>
#include <QTransform>
#include <QVector>
#include <QString>
#include <optional>

// Alignment between independent, normalized [0..1] reference-map coordinates
// and normalized [0..1] pixels on an imported, user-owned map image.
struct CalibrationAnchor {
    QPointF map;
    QPointF image;
};
namespace Calibration {
    // Two anchors: similarity (rotation + uniform scale + translation).
    // Three noncollinear anchors: complete affine transform.
    std::optional<QTransform> fit(const QVector<CalibrationAnchor>& anchors,
                                  QString* error = nullptr);
    QByteArray encode(const QVector<CalibrationAnchor>& anchors);
    std::optional<QVector<CalibrationAnchor>> decode(const QByteArray& serialized,
                                                     QString* error = nullptr);
}
