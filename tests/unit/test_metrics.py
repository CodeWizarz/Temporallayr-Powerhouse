"""Unit tests for metrics registry."""

from temporallayr.core.metrics import _Counter, _Gauge, _Histogram, render_all


def test_counter_increments():
    c = _Counter("test_counter", "help", ["label"])
    c.inc(label="a")
    c.inc(label="a")
    c.inc(2.0, label="b")
    rendered = c.render()
    assert "test_counter" in rendered


def test_gauge_set_get():
    g = _Gauge("test_gauge", "help")
    g.set(42.0)
    assert "42.0" in g.render()
    g.inc(8)
    assert "50.0" in g.render()


def test_histogram_buckets():
    h = _Histogram("test_hist", "help")
    h.observe(10)
    h.observe(500)
    rendered = h.render()
    assert "_bucket" in rendered
    assert "_sum" in rendered
    assert "_count" in rendered


def test_render_all_no_crash():
    output = render_all()
    assert len(output) > 0
    assert "# HELP" in output
    assert "# TYPE" in output
