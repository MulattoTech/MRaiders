#include "main_window.h"
#include <QApplication>
#include <QCoreApplication>

int main(int argc, char** argv) {
    QApplication application(argc, argv);
    QCoreApplication::setOrganizationName("MulattoTech");
    QCoreApplication::setApplicationName("MRaiders");
    MainWindow mainWindow;
    mainWindow.show();
    return application.exec();
}
