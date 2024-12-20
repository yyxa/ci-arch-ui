# ci-arch-ui

Для работы необходимо добавить:

monitor consumer.py

```python
TARGET_URL = 'http://ci-arch-ui:5000/events'

def handle_event(id, details_str):
    details = json.loads(details_str)

    if check_operation(id, details):
        requests.post(
                TARGET_URL,
                json={
                    "id": id,
                    "details": details
                },
                timeout=5
            )

        return proceed_to_deliver(id, details)

```