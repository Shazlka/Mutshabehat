# Mushaf 1441 iOS app. Every step from a clean checkout, for a person or an agent:
#   make test        # data + fonts + project, then core tests and UI tests on an iPhone simulator
#   make run         # build and launch on the iPhone simulator
#   make open        # open the generated project in Xcode
REPO     := $(abspath ../..)
GEN      := Generated
FIXTURES := $(REPO)/packages/quran-data/mushaf1441/fixtures
DERIVED  := DerivedData
SIM      ?= iPhone 18 Pro Max
IPAD     ?= iPad Pro 13-inch (M5)
APP      := $(DERIVED)/Build/Products/Debug-iphonesimulator/Mutshabehat.app
XCB       = xcodebuild -project Mutshabehat.xcodeproj -scheme Mutshabehat -derivedDataPath $(DERIVED)

.PHONY: all data fonts project data-test core-test perf build test test-ipad run open clean

all: data fonts project

data: $(GEN)/mushaf.sqlite

$(GEN)/mushaf.sqlite: $(REPO)/scripts/ios/build_mushaf_db.py $(FIXTURES)/page-metadata.json $(wildcard $(FIXTURES)/page-words/*.json)
	@mkdir -p $(GEN)
	python3 $(REPO)/scripts/ios/build_mushaf_db.py $(REPO) $@

fonts:
	$(REPO)/scripts/ios/fetch_qcf_fonts.sh $(GEN)/Fonts

project: Mutshabehat.xcodeproj

Mutshabehat.xcodeproj: project.yml
	xcodegen generate --quiet

data-test:
	python3 $(REPO)/scripts/ios/test_build_mushaf_db.py -v

core-test: data fonts
	swift test --package-path MushafCore

perf: data fonts
	swift test -c release --package-path MushafCore --filter PerformanceTests

build: all
	$(XCB) -destination 'platform=iOS Simulator,name=$(SIM)' build

test: all data-test core-test
	$(XCB) -destination 'platform=iOS Simulator,name=$(SIM)' test

test-ipad: all
	$(XCB) -destination 'platform=iOS Simulator,name=$(IPAD)' test

run: build
	xcrun simctl boot "$(SIM)" 2>/dev/null || true
	open -a Simulator
	xcrun simctl install "$(SIM)" $(APP)
	xcrun simctl launch "$(SIM)" com.shazlka.qiraat

open: all
	open Mutshabehat.xcodeproj

clean:
	rm -rf $(DERIVED) Mutshabehat.xcodeproj MushafCore/.build
