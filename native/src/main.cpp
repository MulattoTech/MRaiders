#include "main_window.h"
#include <QApplication>
#include <QCoreApplication>
#include <QTimer>

int main(int argc, char** argv) {
    QApplication application(argc, argv);
    QCoreApplication::setOrganizationName("MulattoTech");
    QCoreApplication::setApplicationName("MRaiders");
    MainWindow mainWindow;
    mainWindow.show();
    // CI --smoke-test verifies the real Windows executable can initialize its
    // native window and data resources without requiring an interactive session.
    if (QCoreApplication::arguments().contains("--smoke-test"))
        QTimer::singleShot(500, &application, &QCoreApplication::quit);
    return application.exec();
}
