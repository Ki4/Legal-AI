# -*- coding: utf-8 -*-
import pytest

from doc_engine.dates import date_dmy, date_words


def test_date_words():
    assert date_words("2015-06-20") == "20 червня 2015 року"
    assert date_words("1990-05-12") == "12 травня 1990 року"
    assert date_words("2016-09-01") == "1 вересня 2016 року"


def test_date_dmy():
    assert date_dmy("2016-09-01") == "01.09.2016"


def test_bad_month_raises():
    with pytest.raises(ValueError):
        date_words("2016-13-01")
