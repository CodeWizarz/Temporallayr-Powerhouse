from temporallayr.core.metrics import _Counter, _Gauge, _Histogram, render_all


def test_counter():
    c = _Counter("x_total", "help", ["env"])
    c.inc(env="prod")
    c.inc(2.0, env="prod")
    assert 'x_total{env="prod"} 3.0' in c.render()


def test_gauge():
    g = _Gauge("x_open", "help")
    g.set(5)
    g.inc(3)
    assert "8.0" in g.render()


def test_histogram():
    h = _Histogram("x_ms", "help")
    h.observe(10)
    h.observe(600)
    r = h.render()
    assert "_bucket" in r and "_sum" in r and "_count" in r


def test_render_all():
    out = render_all()
    assert "# HELP" in out
    assert "# TYPE" in out
