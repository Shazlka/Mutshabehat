"""Tests for device.py's choices (no Xcode account or iPhone needed): python3 apps/ios/scripts/test_device.py -v"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import device  # noqa: E402


def phone(udid, name="iPhone", reality="physical", tunnel="connected", pairing="paired", kind="iPhone"):
    return {"identifier": "core-" + udid,
            "connectionProperties": {"tunnelState": tunnel, "pairingState": pairing},
            "deviceProperties": {"name": name},
            "hardwareProperties": {"udid": udid, "reality": reality, "platform": "iOS", "deviceType": kind}}


class ChooseTeamTest(unittest.TestCase):
    def test_no_account_means_no_team(self):
        self.assertIsNone(device.choose_team({}))
        self.assertIsNone(device.choose_team({"IDEProvisioningTeamByIdentifier": {}}))

    def test_reads_the_current_xcode_key(self):
        prefs = {"IDEProvisioningTeamByIdentifier": {"acct-1": [
            {"teamID": "ABCDE12345", "teamName": "Amr (Personal Team)", "isFreeProvisioningTeam": True}]}}
        self.assertEqual(device.choose_team(prefs), "ABCDE12345")

    def test_reads_the_older_key(self):
        prefs = {"IDEProvisioningTeams": {"someone": [{"teamID": "FREE000001", "teamType": "Individual"}]}}
        self.assertEqual(device.choose_team(prefs), "FREE000001")

    def test_several_teams_are_never_guessed_between(self):
        # A personal team and an employer's paid team: picking either silently could sign with the wrong one.
        prefs = {"IDEProvisioningTeamByIdentifier": {
            "me": [{"teamID": "MINE000001", "isFreeProvisioningTeam": True}],
            "work": [{"teamID": "WORK000002", "isFreeProvisioningTeam": False}]}}
        with self.assertRaises(device.Ambiguous) as caught:
            device.choose_team(prefs)
        self.assertEqual(caught.exception.choices, ["MINE000001", "WORK000002"])

    def test_the_same_team_under_two_keys_is_one_team(self):
        team = {"teamID": "MINE000001"}
        self.assertEqual(device.choose_team({"IDEProvisioningTeamByIdentifier": {"a": [team]},
                                             "IDEProvisioningTeams": {"b": [team]}}), "MINE000001")


class ChooseDeviceTest(unittest.TestCase):
    def test_skips_simulators_and_picks_the_connected_iphone(self):
        listing = {"result": {"devices": [phone("SIM-1", reality="simulated"),
                                          phone("OFF-1", tunnel="disconnected", pairing="paired"),
                                          phone("00008140-AAA", name="Amr's iPhone")]}}
        chosen = device.choose_device(listing)
        self.assertEqual(chosen["udid"], "00008140-AAA")
        self.assertEqual(chosen["identifier"], "core-00008140-AAA")

    def test_a_paired_but_asleep_iphone_is_still_used_when_it_is_the_only_one(self):
        listing = {"result": {"devices": [phone("OFF-1", tunnel="disconnected")]}}
        self.assertEqual(device.choose_device(listing)["udid"], "OFF-1")

    def test_an_unpaired_iphone_or_none_at_all_is_not_used(self):
        self.assertIsNone(device.choose_device({"result": {"devices": [phone("X", pairing="unpaired")]}}))
        self.assertIsNone(device.choose_device({"result": {"devices": []}}))

    def test_an_ipad_is_not_chosen_without_being_named(self):
        listing = {"result": {"devices": [phone("PAD-1", name="iPad", kind="iPad"), phone("PH-1", name="iPhone")]}}
        self.assertEqual(device.choose_device(listing)["udid"], "PH-1")
        self.assertEqual(device.choose_device(listing, wanted="iPad")["udid"], "PAD-1")

    def test_two_connected_iphones_are_never_guessed_between(self):
        listing = {"result": {"devices": [phone("A1", name="Work iPhone"), phone("B2", name="Amr's iPhone")]}}
        with self.assertRaises(device.Ambiguous) as caught:
            device.choose_device(listing)
        self.assertEqual(caught.exception.choices, ["Work iPhone", "Amr's iPhone"])

    def test_a_name_or_udid_picks_that_device(self):
        listing = {"result": {"devices": [phone("A1", name="Work iPhone"), phone("B2", name="Amr's iPhone")]}}
        self.assertEqual(device.choose_device(listing, wanted="Amr's iPhone")["udid"], "B2")
        self.assertEqual(device.choose_device(listing, wanted="A1")["udid"], "A1")
        self.assertIsNone(device.choose_device(listing, wanted="iPad"))


class SigningFileTest(unittest.TestCase):
    def test_writes_the_team_and_reports_whether_it_changed(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "Signing.xcconfig")
            self.assertTrue(device.write_signing(path, "ABCDE12345"))
            self.assertFalse(device.write_signing(path, "ABCDE12345"))
            with open(path) as f:
                self.assertIn("DEVELOPMENT_TEAM = ABCDE12345", f.read())


if __name__ == "__main__":
    unittest.main()
