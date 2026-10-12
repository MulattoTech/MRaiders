#include "calibration.h"
#include <QtTest/QtTest>
#include <cmath>

class CalibrationTests final : public QObject {
    Q_OBJECT
private slots:
    void fitsSimilarityIncludingRotationAndTranslation() {
        const QVector<CalibrationAnchor> anchors {
            {QPointF(0.20, 0.10), QPointF(0.30, 0.25)},
            {QPointF(0.70, 0.10), QPointF(0.30, 0.75)},
        };
        QString error;
        const auto result = Calibration::fit(anchors, &error);
        QVERIFY2(result.has_value(), qPrintable(error));
        const QPointF sample = result->map(QPointF(0.20, 0.40));
        QVERIFY(std::abs(sample.x() - 0.0) < 1e-8);
        QVERIFY(std::abs(sample.y() - 0.25) < 1e-8);
    }
    void fitsThreeAnchorAffineWithShear() {
        const QVector<CalibrationAnchor> anchors {
            {QPointF(0, 0), QPointF(0.1, 0.2)},
            {QPointF(1, 0), QPointF(0.8, 0.3)},
            {QPointF(0, 1), QPointF(0.2, 0.9)},
        };
        auto transform = Calibration::fit(anchors);
        QVERIFY(transform.has_value());
        const QPointF p = transform->map(QPointF(0.5, 0.5));
        QVERIFY(std::abs(p.x() - 0.5) < 1e-8);
        QVERIFY(std::abs(p.y() - 0.6) < 1e-8);
    }
    void rejectsDegenerateAndMalformed() {
        QVERIFY(!Calibration::fit({}).has_value());
        QVERIFY(!Calibration::fit({
            {QPointF(0.2, 0.2), QPointF(0.1, 0.1)},
            {QPointF(0.2, 0.2), QPointF(0.8, 0.8)}
        }).has_value());
        QVERIFY(!Calibration::fit({
            {QPointF(0.1, 0.1), QPointF(0.1, 0.2)},
            {QPointF(0.5, 0.5), QPointF(0.4, 0.6)},
            {QPointF(0.9, 0.9), QPointF(0.8, 0.8)}
        }).has_value());
        QVERIFY(!Calibration::fit({
            {QPointF(-0.1, 0.1), QPointF(0.1, 0.1)},
            {QPointF(0.5, 0.5), QPointF(0.5, 0.5)}
        }).has_value());
        QVERIFY(!Calibration::decode("{broken").has_value());
        QVERIFY(!Calibration::decode(R"({"schemaVersion":42,"anchors":[]})").has_value());
    }
    void roundTripsValidatedPersistentAnchors() {
        const QVector<CalibrationAnchor> anchors {
            {QPointF(0.2, 0.3), QPointF(0.1, 0.2)},
            {QPointF(0.8, 0.3), QPointF(0.9, 0.2)},
            {QPointF(0.2, 0.8), QPointF(0.1, 0.9)}
        };
        const auto bytes = Calibration::encode(anchors);
        const auto decoded = Calibration::decode(bytes);
        QVERIFY(decoded.has_value());
        QCOMPARE(decoded->size(), 3);
        QCOMPARE(decoded->at(2).image.y(), 0.9);
        QVERIFY(Calibration::fit(*decoded).has_value());
    }
};
QTEST_APPLESS_MAIN(CalibrationTests)
#include "test_calibration.moc"
