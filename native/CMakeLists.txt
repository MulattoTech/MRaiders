add_library(mraiders_core STATIC
    src/map_repository.cpp
    src/calibration.cpp
    src/tracker_repository.cpp
)
target_include_directories(mraiders_core PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/src)
target_link_libraries(mraiders_core PUBLIC Qt6::Core Qt6::Gui)

add_executable(MRaiders WIN32
    src/main.cpp
    src/main_window.cpp
    src/map_view.cpp
    resources.qrc
)
target_link_libraries(MRaiders PRIVATE mraiders_core Qt6::Widgets)
set_target_properties(MRaiders PROPERTIES OUTPUT_NAME "MRaiders")

if(BUILD_TESTING)
    add_executable(mraiders_data_tests tests/test_data.cpp resources.qrc)
    target_link_libraries(mraiders_data_tests PRIVATE mraiders_core Qt6::Test)
    add_test(NAME data_validation COMMAND mraiders_data_tests)
    set_tests_properties(data_validation PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
    add_executable(mraiders_calibration_tests tests/test_calibration.cpp)
    target_link_libraries(mraiders_calibration_tests PRIVATE mraiders_core Qt6::Test)
    add_test(NAME map_calibration COMMAND mraiders_calibration_tests)
    set_tests_properties(map_calibration PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
    add_executable(mraiders_ui_tests
        tests/test_ui.cpp
        src/main_window.cpp
        src/map_view.cpp
        resources.qrc
    )
    target_link_libraries(mraiders_ui_tests PRIVATE mraiders_core Qt6::Widgets Qt6::Test)
    add_test(NAME ui_integration COMMAND mraiders_ui_tests)
    set_tests_properties(ui_integration PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen")
endif()
