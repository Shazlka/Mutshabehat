# Mushaf 1441 iOS app. Every step from a clean checkout, for a person or an agent:
#   make test        # isolation check, data + fonts + project, then every test on an iPhone simulator
# Rules for agents and people: AGENTS.md.
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

.PHONY: all data fonts qiraat qiraat-refresh qiraat-offline project data-test core-test perf build test test-ipad run open device clean check-isolation

all: data fonts qiraat project

data: $(GEN)/mushaf.sqlite $(GEN)/mutshabehat.sqlite

$(GEN)/mushaf.sqlite: scripts/build_mushaf_db.py $(FIXTURES)/page-metadata.json $(wildcard $(FIXTURES)/page-words/*.json)
	@mkdir -p $(GEN)
	@mkdir -p Reports
	python3 scripts/build_mushaf_db.py $(REPO) $@ Reports/quran-search-collisions.json

$(GEN)/mutshabehat.sqlite: scripts/build_mutshabehat_db.py $(GEN)/mutshabehat_seed.json
	@mkdir -p $(GEN)
	python3 scripts/build_mutshabehat_db.py

fonts:
	scripts/fetch_qcf_fonts.sh $(GEN)/Fonts

# Qiraat data: a snapshot of the live web app (its database), the only source. Skips pages
# already present; qiraat-refresh re-downloads every page; qiraat-offline uses the repo fixtures.
qiraat:
	python3 scripts/fetch_qiraat.py $(REPO) $(GEN)/Qiraat

qiraat-refresh:
	python3 scripts/fetch_qiraat.py $(REPO) $(GEN)/Qiraat --refresh

qiraat-offline:
	python3 scripts/fetch_qiraat.py $(REPO) $(GEN)/Qiraat --source fixtures --refresh

# Sync all databases from web app to iCloud Drive Mushaf_Qiraat folder
sync-icloud:
	python3 scripts/sync_webapp_to_icloud.py --update-generated

# Always regenerate: XcodeGen lists source files explicitly, so a new .swift file needs a new
# project even when project.yml is unchanged. Generation takes under a second.
project:
	xcodegen generate --quiet

data-test:
	python3 scripts/test_build_mushaf_db.py -v
	python3 scripts/test_fetch_qcf_fonts.py -v
	python3 scripts/test_fetch_qiraat.py -v
	python3 scripts/test_device.py -v

core-test: data fonts qiraat
	swift test --package-path MushafCore

perf: data fonts qiraat
	swift test -c release --package-path MushafCore --filter PerformanceTests

build: all
	$(XCB) -destination 'platform=iOS Simulator,name=$(SIM)' build

test: check-isolation all data-test core-test
	$(XCB) -destination 'platform=iOS Simulator,name=$(SIM)' test

test-ipad: all
	$(XCB) -destination 'platform=iOS Simulator,name=$(IPAD)' test

run: build
	xcrun simctl boot "$(SIM)" 2>/dev/null || true
	xcrun simctl install "$(SIM)" $(APP)
	xcrun simctl launch "$(SIM)" com.shazlka.qiraat

# On the person's iPhone: needs their Apple ID in Xcode → Settings → Accounts (see AGENTS.md §6).
device: all
	python3 scripts/device.py

open: all
	open Mutshabehat.xcodeproj

check-isolation:
	scripts/check_isolation.sh

clean:
	rm -rf $(DERIVED) Mutshabehat.xcodeproj MushafCore/.build
