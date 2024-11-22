# ci-arch-ui

monitor consumer.py

```python
TARGET_URL = 'http://ci-arch-ui:5000/events'

def handle_event(id, details_str):
    details = json.loads(details_str)

    print(f"[info] handling event {id}, " \
          f"{details['source']}->{details['deliver_to']}: " \
          f"{details['operation']}")

    if check_operation(id, details):
        requests.post(
                TARGET_URL,
                json={
                    "id": id,
                    "details": details
                },
                timeout=5
            )
        print(f"[info] Event {id} sent successfully to {TARGET_URL}.")
        return proceed_to_deliver(id, details)

    print(f"[error] !!!! policies check failed, delivery unauthorized !!! " \
          f"id: {id}, {details['source']}->{details['deliver_to']}: " \
          f"{details['operation']}")
    print(f"[error] suspicious event details: {details}")
```