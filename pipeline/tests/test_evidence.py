import io
import json
import tarfile
import wave
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from asknoor import audio
from asknoor.evidence.flores import load_flores
from asknoor.evidence.mms import run_fleurs
from asknoor.evidence.roundtrip import run_roundtrip
from asknoor.evidence.text import chrf, error_rates, normalize_asr, seeded_sample, sentence_chrf


# ---- metrics -------------------------------------------------------------------------------------


def test_chrf_is_100_for_identical_text_and_lower_for_a_typo():
    same = chrf(["we roast in a pan"], ["we roast in a pan"])
    typo = chrf(["we roast in a pam"], ["we roast in a pan"])
    assert same["chrf"] == 100.0 and same["n"] == 1
    assert 50 < typo["chrf"] < 100
    assert "nc:6" in same["signature"]  # character 6-grams, the sacrebleu default


def test_chrf_rejects_mismatched_or_empty_input():
    with pytest.raises(ValueError):
        chrf(["a"], ["a", "b"])
    with pytest.raises(ValueError):
        chrf([], [])


def test_sentence_chrf_orders_a_close_translation_above_a_wrong_one():
    ref = "We roast in a pan over the fire."
    assert sentence_chrf("We roast in a pan over a fire.", ref) > sentence_chrf("The bus leaves at nine.", ref)


def test_normalize_asr_drops_punctuation_and_case_but_keeps_wolof_letters():
    assert normalize_asr("Ba  ngi, fi!") == "ba ngi fi"
    assert normalize_asr("Ñëw na — àddina.") == "ñëw na àddina"
    assert normalize_asr("It’s here") == "it's here"


def test_error_rates_are_zero_after_normalization_and_count_a_substitution():
    assert error_rates(["ba ngi fi"], ["Ba ngi, fi!"]) == {"wer": 0.0, "cer": 0.0, "n": 1, "reference_words": 3}
    one = error_rates(["ba ngi fa deh"], ["ba ngi fi deh"])
    assert one["wer"] == 0.25 and 0 < one["cer"] < 0.1


def test_error_rates_reject_mismatched_input():
    with pytest.raises(ValueError):
        error_rates(["a"], [])


def test_seeded_sample_is_deterministic_sorted_and_all_when_asked():
    a = seeded_sample(371, 100, 4)
    assert a == seeded_sample(371, 100, 4) and a == sorted(a) and len(set(a)) == 100
    assert a != seeded_sample(371, 100, 5)
    assert seeded_sample(5, None, 4) == [0, 1, 2, 3, 4]
    assert seeded_sample(5, 50, 4) == [0, 1, 2, 3, 4]


# ---- FLORES --------------------------------------------------------------------------------------


def make_tar(path: Path, files: dict[str, str]) -> None:
    with tarfile.open(path, "w:gz") as tar:
        for name, text in files.items():
            data = text.encode()
            info = tarfile.TarInfo(f"./flores200_dataset/devtest/{name}.devtest")
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))


def test_flores_lines_are_read_per_language_and_stay_aligned(tmp_path):
    tar = tmp_path / "f.tar.gz"
    make_tar(tar, {"eng_Latn": "one\ntwo\nthree\n", "wol_Latn": "benn\nñaar\nñett\n"})
    data = load_flores(tar, ("eng_Latn", "wol_Latn"))
    assert data == {"eng_Latn": ["one", "two", "three"], "wol_Latn": ["benn", "ñaar", "ñett"]}


def test_flores_refuses_a_missing_language_and_misaligned_languages(tmp_path):
    tar = tmp_path / "f.tar.gz"
    make_tar(tar, {"eng_Latn": "one\ntwo\n", "wol_Latn": "benn\n"})
    with pytest.raises(ValueError, match="aligned"):
        load_flores(tar, ("eng_Latn", "wol_Latn"))
    with pytest.raises(FileNotFoundError):
        load_flores(tar, ("eng_Latn", "deu_Latn"))


# ---- audio in memory, FLEURS and the round trip --------------------------------------------------


def wav_bytes(seconds: float = 1.0, rate: int = 48_000) -> bytes:
    t = np.arange(int(seconds * rate)) / rate
    pcm = (np.sin(2 * np.pi * 440 * t) * 0.3 * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def test_decode_bytes_resamples_to_16_khz_mono():
    samples = audio.decode_bytes(wav_bytes(1.0), channels=1, sample_rate=16_000)
    assert samples.shape[1] == 1 and abs(len(samples) - 16_000) < 200


class EchoRecognizer:
    """Plumbing check: 'recognizes' the reference text it was told about, in order."""

    def __init__(self, texts):
        self.texts = list(texts)

    def transcribe(self, samples):
        assert samples.dtype == np.float32 and len(samples) > 1000
        return self.texts.pop(0)


def test_fleurs_run_reads_the_parquet_decodes_audio_and_scores_wer(tmp_path):
    refs = ["ba ngi fi rekk", "yenn pàcc yu bari", "ñëw na ci kër gi"]
    table = pa.table(
        {
            "id": pa.array([1, 2, 3], pa.int32()),
            "audio": pa.array([{"bytes": wav_bytes(), "path": f"{i}.wav"} for i in range(3)]),
            "transcription": refs,
        }
    )
    parquet = tmp_path / "t.parquet"
    pq.write_table(table, parquet)
    perfect = run_fleurs(EchoRecognizer(refs), parquet, n=3, seed=4, log=lambda *_: None)
    assert perfect["wer"] == 0.0 and perfect["n"] == 3 and perfect["utterances_in_split"] == 3
    # the sample is sorted by index, so the recognizer sees utterances in file order
    wrong = run_fleurs(EchoRecognizer(["x y", "x y", "x y"]), parquet, n=3, seed=4, log=lambda *_: None)
    assert wrong["wer"] > 0.9


class Backtranslator:
    def translate(self, sentences, lang, src="eng_Latn", batch_size=16):
        assert (lang, src) == ("eng_Latn", "wol_Latn")
        return [s.replace("benn", "one") for s in sentences]


CONSENT = (
    "| Person | What they consented to | Where | Date | Status |\n|---|---|---|---|---|\n"
    "| Preet Patel | AI dubbing of her English recordings | Discord | 2026-10-03 | {status} |\n"
)


def test_roundtrip_transcribes_the_dubs_translates_back_and_scores_against_the_script(tmp_path):
    content = tmp_path / "farm"
    (content / "recordings" / "wo").mkdir(parents=True)
    (content / "clips.json").write_text(json.dumps({"clips": [{"id": 1, "script": {"en": "one two"}}]}))
    (content / "recordings" / "recordings.json").write_text(
        json.dumps({"recordings": [{"clip": 1, "lang": "wo", "file": "wo/clip01_wo.flac", "consentPerson": "Preet Patel"}]})
    )
    wav = tmp_path / "in.wav"
    wav.write_bytes(wav_bytes())
    audio._run(["-i", str(wav), "-y", str(content / "recordings" / "wo" / "clip01_wo.flac")])
    consent = tmp_path / "CONSENT.md"
    consent.write_text(CONSENT.format(status="confirmed"))
    result = run_roundtrip(EchoRecognizer(["benn two"]), Backtranslator(), content, consent, log=lambda *_: None)
    assert result["n"] == 1 and result["pooled_chrf"] == 100.0
    assert result["clips"][0]["wolof_transcript"] == "benn two" and result["clips"][0]["back_to_english"] == "one two"


def test_roundtrip_refuses_dubbed_audio_without_a_confirmed_dubbing_row(tmp_path):
    from asknoor.consent import ConsentError

    content = tmp_path / "farm"
    (content / "recordings" / "wo").mkdir(parents=True)
    (content / "clips.json").write_text(json.dumps({"clips": [{"id": 1, "script": {"en": "one two"}}]}))
    (content / "recordings" / "recordings.json").write_text(
        json.dumps({"recordings": [{"clip": 1, "lang": "wo", "file": "wo/clip01_wo.flac", "consentPerson": "Preet Patel"}]})
    )
    consent = tmp_path / "CONSENT.md"
    consent.write_text(CONSENT.format(status="pending"))
    with pytest.raises(ConsentError, match="pending"):
        run_roundtrip(EchoRecognizer([]), Backtranslator(), content, consent, log=lambda *_: None)
