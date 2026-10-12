#include "catalog_page.h"
#include <QComboBox>
#include <QDialog>
#include <QDialogButtonBox>
#include <QDir>
#include <QFormLayout>
#include <QHeaderView>
#include <QLabel>
#include <QLineEdit>
#include <QMessageBox>
#include <QPushButton>
#include <QSpinBox>
#include <QStandardPaths>
#include <QTableWidget>
#include <QVBoxLayout>
#include <QHBoxLayout>
#include <QSignalBlocker>
#include <QFileInfo>

CatalogPage::CatalogPage(QWidget* parent) : QWidget(parent) {
    const QString appDir = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation);
    QDir().mkpath(appDir);
    store_ = std::make_unique<CatalogStore>(appDir + "/catalog.sqlite");
    QString error;
    const bool ready = store_->open(&error);
    auto* layout = new QVBoxLayout(this);
    layout->addWidget(new QLabel("<b>Offline item / blueprint / quest library</b>"));
    layout->addWidget(new QLabel("User-maintained reference data. No automatic game sync or invented source records."));
    auto* top = new QHBoxLayout;
    search_ = new QLineEdit(this);
    search_->setObjectName("catalogSearch");
    search_->setPlaceholderText("Find items, blueprint notes or quests...");
    filter_ = new QComboBox(this);
    filter_->setObjectName("catalogFilter");
    filter_->addItems({"All", "item", "blueprint", "quest"});
    auto* add = new QPushButton("Add Entry", this);
    add->setObjectName("catalogAdd");
    top->addWidget(search_, 2);top->addWidget(filter_);top->addWidget(add);
    layout->addLayout(top);
    results_ = new QTableWidget(this);
    results_->setObjectName("catalogTable");
    results_->setColumnCount(4);
    results_->setHorizontalHeaderLabels({"Name","Kind","Source","ID"});
    results_->setSelectionBehavior(QAbstractItemView::SelectRows);
    results_->setSelectionMode(QAbstractItemView::SingleSelection);
    results_->setEditTriggers(QAbstractItemView::NoEditTriggers);
    results_->horizontalHeader()->setSectionResizeMode(0,QHeaderView::Stretch);
    results_->horizontalHeader()->setSectionResizeMode(1,QHeaderView::ResizeToContents);
    layout->addWidget(results_,1);
    auto* counts = new QHBoxLayout;
    counts->addWidget(new QLabel("Owned"));
    owned_ = new QSpinBox(this);
    owned_->setObjectName("catalogOwned");
    owned_->setRange(0,999999);
    counts->addWidget(owned_);
    counts->addWidget(new QLabel("Needed"));
    needed_ = new QSpinBox(this);
    needed_->setObjectName("catalogNeeded");
    needed_->setRange(0,999999);
    counts->addWidget(needed_);
    auto* save = new QPushButton("Save Counts",this);
    save->setObjectName("catalogSaveCounts");
    counts->addWidget(save);
    layout->addLayout(counts);
    status_ = new QLabel(this);
    status_->setWordWrap(true);
    layout->addWidget(status_);
    connect(search_,&QLineEdit::textChanged,this,&CatalogPage::refresh);
    connect(filter_,&QComboBox::currentTextChanged,this,&CatalogPage::refresh);
    connect(add,&QPushButton::clicked,this,&CatalogPage::addEntry);
    connect(save,&QPushButton::clicked,this,&CatalogPage::saveCounts);
    connect(results_,&QTableWidget::itemSelectionChanged,this,&CatalogPage::selectionChanged);
    add->setEnabled(ready);
    save->setEnabled(ready);
    if (!ready) status_->setText("Catalog database unavailable: " + error);
    else refresh();
}

void CatalogPage::refresh() {
    const auto entries=store_->search(search_->text(),filter_->currentText()=="All"?"":filter_->currentText());
    results_->setRowCount(0);
    for(const auto& e:entries) {
        const int row=results_->rowCount();
        results_->insertRow(row);
        const QStringList columns={e.name,e.kind,e.source,e.id};
        for(int c=0;c<columns.size();++c) results_->setItem(row,c,new QTableWidgetItem(columns[c]));
    }
    status_->setText(QString("%1 matching entries (up to 500). Schema v%2.")
                         .arg(entries.size()).arg(store_->schemaVersion()));
    selectionChanged();
}

void CatalogPage::selectionChanged() {
    const int row=results_->currentRow();
    const bool selected=row>=0 && results_->item(row,3);
    owned_->setEnabled(selected);
    needed_->setEnabled(selected);
    const QSignalBlocker blockOwned(owned_),blockNeeded(needed_);
    const QString id=selected ? results_->item(row,3)->text() : QString();
    owned_->setValue(selected?store_->owned(id):0);
    needed_->setValue(selected?store_->needed(id):0);
}

void CatalogPage::saveCounts() {
    const int row=results_->currentRow();
    if(row<0 || !results_->item(row,3))return;
    const auto id=results_->item(row,3)->text();
    QString error;
    if(!store_->setOwned(id,owned_->value(),&error) || !store_->setNeeded(id,needed_->value(),&error))
        QMessageBox::warning(this,"Save counts",error);
    else status_->setText("Saved owned and needed counts for " + id);
}

void CatalogPage::addEntry() {
    QDialog dialog(this);
    dialog.setWindowTitle("Add Offline Reference");
    QFormLayout form(&dialog);
    QLineEdit id(&dialog),name(&dialog),source(&dialog),notes(&dialog);
    QComboBox kind(&dialog);
    kind.addItems({"item","blueprint","quest"});
    form.addRow("Stable ID",&id);
    form.addRow("Kind",&kind);
    form.addRow("Name",&name);
    form.addRow("Source / provenance",&source);
    form.addRow("Notes",&notes);
    QDialogButtonBox buttons(QDialogButtonBox::Ok|QDialogButtonBox::Cancel,&dialog);
    form.addRow(&buttons);
    connect(&buttons,&QDialogButtonBox::accepted,&dialog,&QDialog::accept);
    connect(&buttons,&QDialogButtonBox::rejected,&dialog,&QDialog::reject);
    if(dialog.exec()!=QDialog::Accepted)return;
    QString error;
    if (!store_->upsert({id.text(),kind.currentText(),name.text(),source.text(),notes.text()},&error))
        QMessageBox::warning(this,"Invalid entry",error);
    else refresh();
}
