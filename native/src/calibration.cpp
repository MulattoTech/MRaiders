#include "calibration.h"
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <array>
#include <cmath>

namespace {
bool validPoint(const QPointF& p) {
    return std::isfinite(p.x()) && std::isfinite(p.y()) &&
           p.x() >= 0.0 && p.x() <= 1.0 &&
           p.y() >= 0.0 && p.y() <= 1.0;
}
std::optional<QTransform> fail(QString* error, const QString& detail) {
    if (error) *error = detail;
    return std::nullopt;
}
}

// Map-space [0,1]^2 -> normalized user-image [0,1]^2
std::optional<QTransform> Calibration::fit(const QVector<CalibrationAnchor>& anchors,
                                           QString* error) {
    if (anchors.size() != 2 && anchors.size() != 3)
        return fail(error, "Provide exactly two or three anchor pairs");
    for (const auto& a : anchors)
        if (!validPoint(a.map) || !validPoint(a.image))
            return fail(error, "Anchor coordinates must be finite and within 0..1");
    QTransform transform;
    if (anchors.size() == 2) {
        const QPointF p = anchors[1].map - anchors[0].map;
        const QPointF q = anchors[1].image - anchors[0].image;
        const double denominator = p.x() * p.x() + p.y() * p.y();
        const double imageDistance = q.x() * q.x() + q.y() * q.y();
        if (denominator < 1e-10 || imageDistance < 1e-10)
            return fail(error, "Distinct map and image anchors are required");
        const double a = (p.x() * q.x() + p.y() * q.y()) / denominator;
        const double b = (p.x() * q.y() - p.y() * q.x()) / denominator;
        const double tx = anchors[0].image.x() -
                          a * anchors[0].map.x() + b * anchors[0].map.y();
        const double ty = anchors[0].image.y() -
                          b * anchors[0].map.x() - a * anchors[0].map.y();
        transform = QTransform(a, b, 0, -b, a, 0, tx, ty, 1);
    } else {
        const double x1 = anchors[0].map.x(), y1 = anchors[0].map.y();
        const double x2 = anchors[1].map.x(), y2 = anchors[1].map.y();
        const double x3 = anchors[2].map.x(), y3 = anchors[2].map.y();
        const double det = x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2);
        if (std::abs(det) < 1e-9)
            return fail(error, "Three map anchors must not be collinear");
        const auto solve = [&](double z1, double z2, double z3) {
            const double a = (z1 * (y2 - y3) + z2 * (y3 - y1) +
                              z3 * (y1 - y2)) / det;
            const double b = (z1 * (x3 - x2) + z2 * (x1 - x3) +
                              z3 * (x2 - x1)) / det;
            const double t = (z1 * (x2 * y3 - x3 * y2) +
                              z2 * (x3 * y1 - x1 * y3) +
                              z3 * (x1 * y2 - x2 * y1)) / det;
            return std::array<double, 3>{a, b, t};
        };
        const auto u = solve(anchors[0].image.x(), anchors[1].image.x(),
                             anchors[2].image.x());
        const auto v = solve(anchors[0].image.y(), anchors[1].image.y(),
                             anchors[2].image.y());
        transform = QTransform(u[0], v[0], 0, u[1], v[1], 0, u[2], v[2], 1);
    }
    for (const auto& anchor : anchors) {
        const QPointF transformed = transform.map(anchor.map);
        if (!std::isfinite(transformed.x()) || !std::isfinite(transformed.y()) ||
            std::abs(transformed.x() - anchor.image.x()) > 1e-7 ||
            std::abs(transformed.y() - anchor.image.y()) > 1e-7)
            return fail(error, "Calibration solution is numerically unstable");
    }
    if (error) error->clear();
    return transform;
}

QByteArray Calibration::encode(const QVector<CalibrationAnchor>& anchors) {
    QJsonArray items;
    for (const auto& anchor : anchors) {
        QJsonObject entry;
        entry["mapX"] = anchor.map.x();
        entry["mapY"] = anchor.map.y();
        entry["imageX"] = anchor.image.x();
        entry["imageY"] = anchor.image.y();
        items.append(entry);
    }
    QJsonObject payload;
    payload["schemaVersion"] = 1;
    payload["anchors"] = items;
    return QJsonDocument(payload).toJson(QJsonDocument::Compact);
}

std::optional<QVector<CalibrationAnchor>> Calibration::decode(const QByteArray& bytes,
                                                               QString* error) {
    QJsonParseError parseError;
    const QJsonDocument document = QJsonDocument::fromJson(bytes, &parseError);
    if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
        if (error) *error = "Invalid calibration JSON";
        return std::nullopt;
    }
    const QJsonObject root = document.object();
    if (root.value("schemaVersion").toInt() != 1 || !root.value("anchors").isArray()) {
        if (error) *error = "Unsupported calibration schema";
        return std::nullopt;
    }
    const QJsonArray elements = root.value("anchors").toArray();
    if (elements.size() != 2 && elements.size() != 3) {
        if (error) *error = "Calibration must contain two or three pairs";
        return std::nullopt;
    }
    QVector<CalibrationAnchor> anchors;
    for (const auto& value : elements) {
        if (!value.isObject()) {
            if (error) *error = "Invalid calibration anchor object";
            return std::nullopt;
        }
        const QJsonObject entry = value.toObject();
        for (const auto& key : {"mapX", "mapY", "imageX", "imageY"}) {
            if (!entry.value(key).isDouble()) {
                if (error) *error = "Anchor coordinates must be numeric";
                return std::nullopt;
            }
        }
        anchors.append({QPointF(entry.value("mapX").toDouble(), entry.value("mapY").toDouble()),
                        QPointF(entry.value("imageX").toDouble(), entry.value("imageY").toDouble())});
    }
    QString validationError;
    if (!fit(anchors, &validationError)) {
        if (error) *error = validationError;
        return std::nullopt;
    }
    if (error) error->clear();
    return anchors;
}
