// src/app.js

let cy;
let nodeLabelToId = {};
let logNameToNodeId = {};

Promise.all([
    fetch('./objects.json').then((res) => res.json()),
    fetch('./mapping.json').then((res) => res.json())
])
    .then(([graphData, mapping]) => {
        graphData.nodes.forEach((node) => {
            if (node.label) {
                nodeLabelToId[node.label] = node.id;
            }
        });

        Object.keys(mapping).forEach((nodeLabel) => {
            const logName = mapping[nodeLabel];
            if (logName) {
                const nodeId = nodeLabelToId[nodeLabel];
                if (nodeId) {
                    logNameToNodeId[logName] = nodeId;
                }
            }
        });

        const nodes = graphData.nodes.map((node) => ({
            data: {
                id: node.id,
                label: node.label || '',
                color: node.color || '#cccccc',
                shape: node.shape || 'round-rectangle',
                width: node.width || 50,
                height: node.height || 50,
            },
            position: node.position || { x: 0, y: 0 },
        }));

        const edges = graphData.edges.map((edge) => ({
            data: {
                id: edge.id,
                source: edge.source,
                target: edge.target,
                label: edge.label || '',
                lineColor: edge.lineColor || '#888888',
                curveStyle: edge.curveStyle || 'bezier',
            },
        }));

        cy = cytoscape({
            container: document.getElementById('cy'),
            elements: { nodes, edges },
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(color)',
                        shape: 'data(shape)',
                        label: 'data(label)',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'font-size': 12,
                        color: '#000',
                        width: 'data(width)',
                        height: 'data(height)',
                        'text-wrap': 'wrap',
                        'text-max-width': '80px',
                        'text-outline-color': '#fff',
                        'text-outline-width': 1,
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        width: 2,
                        'line-color': 'data(lineColor)',
                        'target-arrow-color': 'data(lineColor)',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'control-point-step-size': 50,
                        label: 'data(label)',
                        'font-size': 10,
                        color: '#555',
                    },
                },
            ],
            layout: {
                name: 'preset',
            },
            zoom: 1,
            pan: { x: 0, y: 0 },
        });

        cy.userZoomingEnabled(true);
        cy.userPanningEnabled(true);
    })
    .catch((error) => console.error('Ошибка при загрузке графа или маппинга:', error));

let processedEventIds = new Set();

function updateEventLog() {
    fetch('/events', { cache: 'no-store' })
        .then((response) => response.json())
        .then((events) => {
            const newEvents = events.filter(event => !processedEventIds.has(event.id));

            newEvents.forEach((event) => {
                processedEventIds.add(event.id);

                const listItem = document.createElement('li');
                listItem.classList.add('event-item');

                const details = event.details || {};

                const source = details.source || 'Unknown';
                const deliver_to = details.deliver_to || 'Unknown';
                const operation = details.operation || 'Unknown';

                const headerDiv = document.createElement('div');
                headerDiv.classList.add('event-header');

                const sourceP = document.createElement('p');
                sourceP.textContent = `Source: ${source}`;
                const deliverToP = document.createElement('p');
                deliverToP.textContent = `Deliver To: ${deliver_to}`;
                const operationP = document.createElement('p');
                operationP.textContent = `Operation: ${operation}`;

                headerDiv.appendChild(sourceP);
                headerDiv.appendChild(deliverToP);
                headerDiv.appendChild(operationP);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('event-details');

                const { source: _, deliver_to: __, operation: ___, ...otherDetails } = details;

                if (Object.keys(otherDetails).length > 0) {
                    detailsDiv.textContent = JSON.stringify(otherDetails, null, 2);
                } else {
                    detailsDiv.textContent = 'No additional details.';
                }

                listItem.appendChild(headerDiv);
                listItem.appendChild(detailsDiv);

                listItem.addEventListener('mousedown', (event) => {
                    event.stopPropagation();
                    detailsDiv.style.display =
                        detailsDiv.style.display === 'none' ? 'block' : 'none';
                });

                const eventList = document.getElementById('event-list');
                eventList.insertBefore(listItem, eventList.firstChild);

                handleGraphAnimation(event);
            });

            if (processedEventIds.size > 1000) {
                processedEventIds = new Set(Array.from(processedEventIds).slice(-500));
            }
        })
        .catch((error) => console.error('Ошибка при загрузке событий:', error));
}
setInterval(updateEventLog, 1000);

function getNodeIdFromLogName(logName) {
    const nodeId = logNameToNodeId[logName];
    if (nodeId) return nodeId;

    const node = cy.nodes().filter((n) => n.data('label') === logName).first();
    if (node) return node.id();

    return null;
}

function handleGraphAnimation(event) {
    const sourceLogName = event.details.source;
    const deliverToLogName = event.details.deliver_to;

    const sourceNodeId = getNodeIdFromLogName(sourceLogName);
    const targetNodeId = getNodeIdFromLogName(deliverToLogName);

    if (sourceNodeId && targetNodeId) {
        const edge = cy.edges(`[source = "${sourceNodeId}"][target = "${targetNodeId}"]`);
        if (edge && edge.length > 0) {
            const sourceNode = cy.getElementById(sourceNodeId);
            const targetNode = cy.getElementById(targetNodeId);

            const sourcePosition = sourceNode.renderedPosition();
            const targetPosition = targetNode.renderedPosition();

            const marker = document.createElement('div');
            marker.style.position = 'absolute';
            marker.style.width = '10px';
            marker.style.height = '10px';
            marker.style.backgroundColor = '#ff0000';
            marker.style.borderRadius = '50%';
            marker.style.zIndex = '9999';
            document.body.appendChild(marker);

            const updateMarkerPosition = (x, y) => {
                marker.style.left = `${x}px`;
                marker.style.top = `${y}px`;
            };

            updateMarkerPosition(sourcePosition.x, sourcePosition.y);

            const animationDuration = 1000;
            const startTime = performance.now();

            function animateMarker(timestamp) {
                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / animationDuration, 1);

                const currentX = sourcePosition.x + (targetPosition.x - sourcePosition.x) * progress;
                const currentY = sourcePosition.y + (targetPosition.y - sourcePosition.y) * progress;

                updateMarkerPosition(currentX, currentY);

                if (progress < 1) {
                    requestAnimationFrame(animateMarker);
                } else {
                    marker.remove();
                }
            }

            requestAnimationFrame(animateMarker);

            edge.style('line-color', '#ff0000');
            setTimeout(() => {
                edge.style('line-color', edge.data('lineColor') || '#888888');
            }, animationDuration);
        } else {
            console.warn(`Ребро не найдено между ${sourceNodeId} и ${targetNodeId}`);
        }
    } else {
        console.warn(`Узлы не найдены для source: ${sourceLogName}, target: ${deliverToLogName}`);
    }
}

document.getElementById('toggle-events-log').addEventListener('click', () => {
    const eventsContainer = document.getElementById('events-container');
    const toggleButton = document.getElementById('toggle-events-log');
    if (eventsContainer.classList.contains('hidden')) {
        eventsContainer.classList.remove('hidden');
        toggleButton.textContent = 'Скрыть лог';
    } else {
        eventsContainer.classList.add('hidden');
        toggleButton.textContent = 'Показать лог';
    }
});
