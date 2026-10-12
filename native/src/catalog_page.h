#pragma once
#include "catalog_store.h"
#include <QWidget>
#include <memory>
class QComboBox;
class QLineEdit;
class QTableWidget;
class QSpinBox;
class QLabel;

class CatalogPage final : public QWidget {
    Q_OBJECT
public:
    explicit CatalogPage(QWidget* parent = nullptr);
private:
    void refresh();
    void addEntry();
    void saveCounts();
    void selectionChanged();
    std::unique_ptr<CatalogStore> store_;
    QLineEdit* search_ = nullptr;
    QComboBox* filter_ = nullptr;
    QTableWidget* results_ = nullptr;
    QSpinBox* owned_ = nullptr;
    QSpinBox* needed_ = nullptr;
    QLabel* status_ = nullptr;
};
