def register(subparsers) -> None:
    test_parser = subparsers.add_parser(
        "test", help="Dispatch a test trace to verify background telemetry."
    )
    test_parser.set_defaults(func=_run_test)


def _run_test(args) -> None:
    """Trigger a fast end-to-end execution graph dispatch to verify telemetry ingestion."""
    import time

    from temporallayr import init, track

    print("Bootstrapping dummy payload validation for Temporallayr...")
    init()

    @track(type="test_probe")
    def _test_operation() -> str:
        time.sleep(0.1)
        return "Probe Completed"

    result = _test_operation()
    time.sleep(2.5)  # Allow background transport to flush
    print(f"✓ Test operation returned: '{result}' and sent to flush queues natively.")
