"""
Cooperative cancellation: the UI can ask for a running conversion to stop, and
the converter notices between frames instead of being killed.
"""

import threading


class Cancelled(Exception):
    """Raised inside a conversion that was asked to stop"""


class CancelRegistry:
    """Thread-safe set of request ids that should stop (or never start)"""

    # A cancel for a request that already finished is never cleaned up, so
    # don't let those pile up forever
    MAX_REMEMBERED = 1000

    def __init__(self):
        self._ids = set()
        self._lock = threading.Lock()

    def add(self, request_id):
        if request_id is None:
            return
        with self._lock:
            if len(self._ids) >= self.MAX_REMEMBERED:
                self._ids.clear()
            self._ids.add(request_id)

    def __contains__(self, request_id):
        with self._lock:
            return request_id in self._ids

    def discard(self, request_id):
        with self._lock:
            self._ids.discard(request_id)

    def check(self, request_id):
        """Raise Cancelled if this request was cancelled"""
        if request_id is not None and request_id in self:
            raise Cancelled()
