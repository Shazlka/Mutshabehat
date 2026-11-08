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

.PHONY: all data fonts qiraat references mutoon matn-symbols qiraat-refresh qiraat-offline project data-test core-test perf build test test-ipad screenshots run open device clean check-isolation release-guard

all: data fonts qiraat project

data: $(GEN)/mushaf.sqlite

$(GEN)/mushaf.sqlite: scripts/build_mushaf_db.py $(FIXTURES)/page-metadata.json $(wildcard $(FIXTURES)/page-words/*.json)
	@mkdir -p $(GEN)
	@mkdir -p Reports
	python3 scripts/build_mushaf_db.py $(REPO) $@ Reports/quran-search-collisions.json

fonts:
	scripts/fetch_qcf_fonts.sh $(GEN)/Fonts

# Qiraat data: a snapshot of the live web app (its database), the only source. Skips pages
# already present; qiraat-refresh re-downloads every page; qiraat-offline uses the repo fixtures.
qiraat:
	python3 scripts/fetch_qiraat.py $(REPO) $(GEN)/Qiraat

# Scholarly references (الشاطبية، الدرة، طيبة النشر per variant): your own references.json, copied unchanged
# into Generated/QiraatReferences (never committed). Format: docs/qiraat-references-format.md.
#   make references REFERENCES_SRC=/path/to/folder-with-references.json
references:
	@test -n "$(REFERENCES_SRC)" -a -s "$(REFERENCES_SRC)/references.json" || { echo "error: set REFERENCES_SRC to a folder holding references.json"; exit 1; }
	mkdir -p $(GEN)/QiraatReferences
	cp "$(REFERENCES_SRC)/references.json" $(GEN)/QiraatReferences/references.json

# The three متون (الشاطبية، الدرة، طيبة النشر) for the «المتون» page: built from the locally parsed Shamela verses
# into Generated/QiraatMutoon (never committed). Bundled by the build when present.
#   make mutoon MUTOON_SRC=/path/to/verses.json
MUTOON_SRC ?= $(GEN)/QiraatReferences-full/verses.json
mutoon:
	python3 scripts/build_mutoon.py "$(MUTOON_SRC)" $(GEN)/QiraatMutoon/mutoon.json

# Where the reader and narrator symbols sit in the متون (red letters on the «المتون» page): built from a list of marks,
# each checked against a شرح (by hand, or matched to it by Generated/QiraatMutoon/sharh_symbols.py), into
# Generated/QiraatMutoon/mutoon-symbols.json. Run after `make mutoon`. Uses symbols-all.json when present, else the
# hand-checked sample.
#   make matn-symbols MATN_SYMBOLS_SRC=/path/to/marks.json
MATN_SYMBOLS_SRC ?= $(firstword $(wildcard $(GEN)/QiraatMutoon/symbols-all.json) $(GEN)/QiraatMutoon/symbols-sample.json)
matn-symbols:
	python3 scripts/build_matn_symbols.py "$(MATN_SYMBOLS_SRC)" $(GEN)/QiraatMutoon/mutoon.json $(GEN)/QiraatMutoon/mutoon-symbols.json

# Verse-by-verse commentary (الوافي for الشاطبية; الهادي for طيبة النشر): built into Generated/QiraatMutoon/mutoon-sharh.json.
#   make matn-sharh
SHARH_HTML_SRC ?= $(GEN)/Shamela/sharh-html
matn-sharh:
	python3 scripts/build_matn_sharh.py "$(SHARH_HTML_SRC)" $(GEN)/QiraatMutoon/mutoon.json $(GEN)/QiraatMutoon/mutoon-sharh.json

qiraat-refresh:
	python3 scripts/fetch_qiraat.py $(REPO) $(GEN)/Qiraat --refresh

qiraat-offline:
	python3 scripts/fetch_qiraat.py $(REPO) $(GEN)/Qiraat --source fixtures --refresh

# Always regenerate: XcodeGen lists source files explicitly, so a new .swift file needs a new
# project even when project.yml is unchanged. Generation takes under a second.
project:
	xcodegen generate --quiet

data-test:
	python3 scripts/test_build_mushaf_db.py -v
	python3 scripts/test_fetch_qcf_fonts.py -v
	python3 scripts/test_fetch_qiraat.py -v
	python3 scripts/test_build_mutoon.py -v
	python3 scripts/test_build_matn_symbols.py -v
	python3 scripts/test_build_matn_sharh.py -v
	cd scripts && python3 test_release_guard.py -v
	python3 scripts/test_device.py -v

core-test: data fonts qiraat
	swift test --package-path MushafCore

perf: data fonts qiraat
	swift test -c release --package-path MushafCore --filter PerformanceTests

build: all
	$(XCB) -destination 'platform=iOS Simulator,name=$(SIM)' build

test: check-isolation all data-test core-test release-guard
	$(XCB) -destination 'platform=iOS Simulator,name=$(SIM)' -collect-test-diagnostics never test

# A Release build must carry nothing of the DEBUG-only review editor (symbols, API path, bundled reference data).
RELEASE_APP := $(DERIVED)/Build/Products/Release-iphonesimulator/Mutshabehat.app
release-guard: all
	$(XCB) -configuration Release -destination 'generic/platform=iOS Simulator' build
	python3 scripts/release_guard.py $(RELEASE_APP)

test-ipad: all
	$(XCB) -destination 'platform=iOS Simulator,name=$(IPAD)' -collect-test-diagnostics never test

screenshots: all
	scripts/app_store_screenshots.sh

run: build
	xcrun simctl boot "$(SIM)" 2>/dev/null || true
	xcrun simctl install "$(SIM)" $(APP)
	xcrun simctl launch "$(SIM)" com.shazlka.qiraat.standalone

# On the person's iPhone: needs their Apple ID in Xcode → Settings → Accounts (see AGENTS.md §6).
device: all
	python3 scripts/device.py

open: all
	open Mutshabehat.xcodeproj

check-isolation:
	scripts/check_isolation.sh

clean:
	rm -rf $(DERIVED) Mutshabehat.xcodeproj MushafCore/.build
