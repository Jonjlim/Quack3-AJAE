import copy
import os

# Must be set before app import so the background ticker stays off during tests.
os.environ.setdefault("TESTING", "true")
os.environ.setdefault("REQUIRE_FIREBASE_AUTH", "false")

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.mock_data import MOCK_ALERTS, MOCK_PATIENTS
from app.services import state as state_module


def reset_state() -> None:
    state_module.state_service.patients = [p.model_copy(deep=True) for p in MOCK_PATIENTS]
    state_module.state_service.alerts = copy.deepcopy(MOCK_ALERTS)
    state_module.state_service._recompute()


@pytest.fixture(autouse=True)
def _fresh_state() -> None:
    reset_state()


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client
