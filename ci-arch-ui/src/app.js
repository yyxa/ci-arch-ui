// src/app.js

let cy;
let nodeLabelToId = {};
let logNameToNodeId = {};

const currentEventQueue = [];
const completedEventQueue = [];
let isAnimating = false;

const activeNodes = new Set();

let animationSpeed = 800;
let animationMode = 'auto';

// Функция инициализации Cytoscape
function initializeCytoscape(graphData, mapping) {
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
            color: (node.color && node.color.toLowerCase() !== 'none') ? node.color : '#cccccc',
            shape: node.shape || 'round-rectangle',
            width: node.width || 50,
            height: node.height || 50,
        },
        position: node.position || { x: 0, y: 0 },
        locked: false, // Сделать все узлы перемещаемыми
    }));

    const edges = graphData.edges.map((edge) => ({
        data: {
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label || '',
            lineColor: (edge.lineColor && edge.lineColor.toLowerCase() !== 'none') ? edge.lineColor : '#888888',
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
                    'background-color': '#cccccc',
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
                    'transition-property': 'background-color',
                    'transition-duration': '300ms',
                },
            },
            {
                selector: 'node[color]',
                style: {
                    'background-color': 'data(color)',
                },
            },
            {
                selector: 'edge',
                style: {
                    width: 2,
                    'line-color': '#888888',
                    'target-arrow-color': '#888888',
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'control-point-step-size': 50,
                    label: 'data(label)',
                    'font-size': 10,
                    color: '#555',
                    'transition-property': 'line-color',
                    'transition-duration': '300ms'
                },
            },
            {
                selector: 'edge[lineColor]',
                style: {
                    'line-color': 'data(lineColor)',
                    'target-arrow-color': 'data(lineColor)',
                }
            },
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#e74c3c',
                    'line-color': '#e74c3c',
                    'target-arrow-color': '#e74c3c',
                }
            },
            {
                selector: '.highlighted-message',
                style: {
                    'border-width': 2,
                    'border-color': '#f1c40f',
                }
            }
        ],
        layout: {
            name: 'preset',
            positions: (node) => node.data('position'),
            zoom: 1,
            pan: { x: 0, y: 0 },
        },
        zoom: 1,
        pan: { x: 0, y: 0 },
        userZoomingEnabled: true,
        userPanningEnabled: true,
        userDragEnabled: true, // Разрешить перетаскивание узлов
    });

    // Добавление обработчиков событий для узлов
    cy.on('mouseover', 'node', (event) => {
        const node = event.target;
        highlightMessagesByNode(node.data('label'));
    });

    cy.on('mouseout', 'node', () => {
        removeMessageHighlights();
    });

    // Добавление обработчиков событий для рёбер
    cy.on('mouseover', 'edge', (event) => {
        const edge = event.target;
        const sourceLabel = cy.getElementById(edge.data('source')).data('label');
        const targetLabel = cy.getElementById(edge.data('target')).data('label');
        highlightMessagesByEdge(sourceLabel, targetLabel);
    });

    cy.on('mouseout', 'edge', () => {
        removeMessageHighlights();
    });
}

// Загрузка данных графа и маппинга
function loadData() {
    Promise.all([
        fetch('/objects.json').then((res) => res.json()),
        fetch('/mapping.json').then((res) => res.json())
    ])
    .then(([graphData, mapping]) => {
        initializeCytoscape(graphData, mapping);
        cy.fit(); // Центрирование графа
        initializeControls();
    })
    .catch((error) => console.error('Ошибка при загрузке графа или маппинга:', error));
}

// Обработчик событий
let processedEventIds = new Set();

// Функция обновления лога событий
function updateEventLog() {
    fetch('/events', { cache: 'no-store' })
        .then((response) => response.json())
        .then((events) => {
            const newEvents = events.filter(event => !processedEventIds.has(event.id));

            newEvents.forEach((event) => {
                processedEventIds.add(event.id);
                addEventToLog(event);
                enqueueEvent(event);
            });

            if (processedEventIds.size > 1000) {
                processedEventIds = new Set(Array.from(processedEventIds).slice(-500));
            }
        })
        .catch((error) => console.error('Ошибка при загрузке событий:', error));
}

// Добавление события в очередь для анимации
function enqueueEvent(event) {
    const { source, deliver_to } = event.details;
    const sourceNodeId = getNodeIdFromLogName(source);
    const targetNodeId = getNodeIdFromLogName(deliver_to);

    if (!sourceNodeId || !targetNodeId) {
        console.warn(`Узлы не найдены для source: ${source}, target: ${deliver_to}`);
        return;
    }

    if (!activeNodes.has(sourceNodeId) && !activeNodes.has(targetNodeId)) {
        activeNodes.add(sourceNodeId);
        activeNodes.add(targetNodeId);
        currentEventQueue.push(event);
        if (!isAnimating) {
            processEventQueue();
        }
    } else {
        currentEventQueue.push(event);
        if (!isAnimating) {
            processEventQueue();
        }
    }
}

// Функция добавления события в лог
function addEventToLog(event) {
    const listItem = document.createElement('li');
    listItem.classList.add('event-item');
    listItem.dataset.eventId = event.id;

    const details = event.details || {};
    const source = details.source || 'Unknown';
    const deliver_to = details.deliver_to || 'Unknown';
    const operation = details.operation || 'Unknown';

    const headerDiv = document.createElement('div');
    headerDiv.classList.add('event-header');

    const sourceP = document.createElement('p');
    sourceP.textContent = `Источник: ${source}`;
    const deliverToP = document.createElement('p');
    deliverToP.textContent = `Получатель: ${deliver_to}`;
    const operationP = document.createElement('p');
    operationP.textContent = `Операция: ${operation}`;

    headerDiv.appendChild(sourceP);
    headerDiv.appendChild(deliverToP);
    headerDiv.appendChild(operationP);

    const detailsDiv = document.createElement('div');
    detailsDiv.classList.add('event-details');
    const { source: _, deliver_to: __, operation: ___, ...otherDetails } = details;

    if (Object.keys(otherDetails).length > 0) {
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(otherDetails, null, 2);
        detailsDiv.appendChild(pre);
    } else {
        detailsDiv.textContent = 'Нет дополнительных деталей.';
    }

    detailsDiv.style.display = 'none';

    // Клик для раскрытия/сокрытия деталей
    listItem.addEventListener('click', (evt) => {
        evt.stopPropagation();
        const isVisible = detailsDiv.style.display === 'block';
        detailsDiv.style.display = isVisible ? 'none' : 'block';
    });

    // Наведение для подсветки элементов графа
    listItem.addEventListener('mouseenter', () => {
        highlightGraphElements(event);
        listItem.classList.add('highlighted-message');
    });
    listItem.addEventListener('mouseleave', () => {
        removeHighlight();
        listItem.classList.remove('highlighted-message');
    });

    listItem.appendChild(headerDiv);
    listItem.appendChild(detailsDiv);

    const eventList = document.getElementById('current-event-list');
    eventList.insertBefore(listItem, eventList.firstChild);
}

// Функция подсветки сообщений по узлу
function highlightMessagesByNode(nodeLabel) {
    const messages = document.querySelectorAll('.event-item');
    messages.forEach((msg) => {
        const event = getEventById(msg.dataset.eventId);
        if (event && (event.details.source === nodeLabel || event.details.deliver_to === nodeLabel)) {
            msg.classList.add('highlighted-message');
        }
    });
}

// Функция подсветки сообщений по ребру
function highlightMessagesByEdge(sourceLabel, targetLabel) {
    const messages = document.querySelectorAll('.event-item');
    messages.forEach((msg) => {
        const event = getEventById(msg.dataset.eventId);
        if (event && event.details.source === sourceLabel && event.details.deliver_to === targetLabel) {
            msg.classList.add('highlighted-message');
        }
    });
}

// Функция снятия подсветки с сообщений
function removeMessageHighlights() {
    const messages = document.querySelectorAll('.event-item.highlighted-message');
    messages.forEach((msg) => {
        msg.classList.remove('highlighted-message');
    });
}

// Функция подсветки элементов графа при наведении на сообщение
function highlightGraphElements(event) {
    const sourceLogName = event.details.source;
    const deliverToLogName = event.details.deliver_to;

    const sourceNodeId = getNodeIdFromLogName(sourceLogName);
    const targetNodeId = getNodeIdFromLogName(deliverToLogName);

    if (sourceNodeId && targetNodeId) {
        const sourceNode = cy.getElementById(sourceNodeId);
        const targetNode = cy.getElementById(targetNodeId);
        const edge = cy.edges(`[source="${sourceNodeId}"][target="${targetNodeId}"]`);

        sourceNode.addClass('highlighted');
        targetNode.addClass('highlighted');
        edge.addClass('highlighted');
    }
}

// Функция снятия подсветки
function removeHighlight() {
    cy.elements().removeClass('highlighted');
}

// Функция получения события по ID
function getEventById(eventId) {
    // Реализуйте эту функцию в зависимости от того, как вы храните события
    // Например, можно хранить все события в массиве или объекте
    // Здесь предполагается, что события уже добавлены в DOM
    const listItem = document.querySelector(`.event-item[data-event-id="${eventId}"]`);
    if (listItem) {
        // Извлечь данные из listItem, если необходимо
        // Для простоты возвращаем объект с деталями
        const sourceText = listItem.querySelector('.event-header p:nth-child(1)').textContent;
        const deliverToText = listItem.querySelector('.event-header p:nth-child(2)').textContent;
        const operationText = listItem.querySelector('.event-header p:nth-child(3)').textContent;

        return {
            details: {
                source: sourceText.replace('Источник: ', ''),
                deliver_to: deliverToText.replace('Получатель: ', ''),
                operation: operationText.replace('Операция: ', ''),
            }
        };
    }
    return null;
}

// Функция получения ID узла по логическому имени
function getNodeIdFromLogName(logName) {
    const nodeId = logNameToNodeId[logName];
    if (nodeId) return nodeId;

    const node = cy.nodes().filter((n) => n.data('label') === logName).first();
    if (node) return node.id();

    return null;
}

// Функция обработки очереди событий
async function processEventQueue() {
    if (isAnimating) return;
    if (currentEventQueue.length === 0) return;

    isAnimating = true;

    if (animationMode === 'sequential') {
        while (currentEventQueue.length > 0) {
            const event = currentEventQueue.shift();
            await handleGraphAnimation(event);
            moveToCompleted(event);
        }
    } else { // auto
        const animations = [];
        while (currentEventQueue.length > 0) {
            const event = currentEventQueue.shift();
            animations.push(handleGraphAnimation(event).then(() => {
                moveToCompleted(event);
            }));
        }
        await Promise.all(animations);
    }

    isAnimating = false;
}

// Функция анимации маркера по ребру
function handleGraphAnimation(event) {
    return new Promise((resolve) => {
        const sourceLogName = event.details.source;
        const deliverToLogName = event.details.deliver_to;

        const sourceNodeId = getNodeIdFromLogName(sourceLogName);
        const targetNodeId = getNodeIdFromLogName(deliverToLogName);

        if (!sourceNodeId || !targetNodeId) {
            console.warn(`Узлы не найдены для source: ${sourceLogName}, target: ${deliverToLogName}`);
            activeNodes.delete(sourceNodeId);
            activeNodes.delete(targetNodeId);
            return resolve();
        }

        const edge = cy.edges(`[source="${sourceNodeId}"][target="${targetNodeId}"]`);
        if (!edge || edge.length === 0) {
            console.warn(`Ребро не найдено между ${sourceNodeId} и ${targetNodeId}`);
            activeNodes.delete(sourceNodeId);
            activeNodes.delete(targetNodeId);
            return resolve();
        }

        const sourceNode = cy.getElementById(sourceNodeId);
        const targetNode = cy.getElementById(targetNodeId);

        sourceNode.addClass('highlighted');
        targetNode.addClass('highlighted');
        edge.addClass('highlighted');

        const eventListItem = document.querySelector(`.event-item[data-event-id="${event.id}"]`);
        if (eventListItem) {
            eventListItem.classList.add('active');
        }

        const marker = document.createElement('div');
        marker.classList.add('marker');
        cy.container().appendChild(marker);

        const animationDuration = animationSpeed;
        const startTime = performance.now();

        edge.style('line-color', '#e74c3c');

        function animateMarker(timestamp) {
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / animationDuration, 1);

            const sourcePos = sourceNode.renderedPosition();
            const targetPos = targetNode.renderedPosition();

            const currentX = sourcePos.x + (targetPos.x - sourcePos.x) * progress;
            const currentY = sourcePos.y + (targetPos.y - sourcePos.y) * progress;

            marker.style.left = `${currentX}px`;
            marker.style.top = `${currentY}px`;

            if (progress < 1) {
                requestAnimationFrame(animateMarker);
            } else {
                marker.remove();
                edge.style('line-color', edge.data('lineColor') || '#888888');
                removeHighlight();
                if (eventListItem) {
                    eventListItem.classList.remove('active');
                }
                activeNodes.delete(sourceNodeId);
                activeNodes.delete(targetNodeId);
                resolve();
            }
        }

        requestAnimationFrame(animateMarker);
    });
}

// Функция перемещения события в завершённые логи
function moveToCompleted(event) {
    const eventListItem = document.querySelector(`.event-item[data-event-id="${event.id}"]`);
    if (eventListItem) {
        document.getElementById('current-event-list').removeChild(eventListItem);
        document.getElementById('completed-event-list').insertBefore(eventListItem, document.getElementById('completed-event-list').firstChild);
    }
}

// Функция обновления ползунка скорости анимации
function setupAnimationSpeedControl() {
    const speedSlider = document.getElementById('animation-speed');
    speedSlider.addEventListener('input', (e) => {
        animationSpeed = parseInt(e.target.value, 10);
    });
}

// Функция обновления режима анимации
function setupAnimationModeControl() {
    const modeSelect = document.getElementById('animation-mode');
    modeSelect.addEventListener('change', (e) => {
        animationMode = e.target.value;
        if (!isAnimating) {
            processEventQueue();
        }
    });
}

// Функция добавления события в завершённые логи по клику
function setupCompletedLogsClick() {
    const completedEventList = document.getElementById('completed-event-list');
    completedEventList.addEventListener('click', (evt) => {
        const listItem = evt.target.closest('.event-item');
        if (listItem) {
            const eventId = listItem.dataset.eventId;
            alert(`Дополнительная информация для события ID: ${eventId}`);
        }
    });
}

// Функция обработки кнопок сворачивания/разворачивания логов
function setupToggleButtons() {
    const showQueueButton = document.getElementById('show-queue');
    const showHistoryButton = document.getElementById('show-history');
    const queueLogs = document.getElementById('queue-logs');
    const historyLogs = document.getElementById('history-logs');

    showQueueButton.addEventListener('click', () => {
        showQueueButton.classList.add('active');
        showHistoryButton.classList.remove('active');
        queueLogs.classList.remove('hidden');
        historyLogs.classList.add('hidden');
    });

    showHistoryButton.addEventListener('click', () => {
        showHistoryButton.classList.add('active');
        showQueueButton.classList.remove('active');
        historyLogs.classList.remove('hidden');
        queueLogs.classList.add('hidden');
    });
}

// Функциональность ползунка зума
function setupZoomControl() {
    const zoomSlider = document.getElementById('zoom-slider');

    if (zoomSlider) {
        zoomSlider.addEventListener('input', (e) => {
            const zoomValue = parseFloat(e.target.value);
            cy.zoom({
                level: zoomValue,
                renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 }
            });
        });
    }
}

// Логика ресайзинга блоков логов
function setupResizers() {
    const resizerRight = document.getElementById('resizer-right');
    let isResizingRight = false;

    resizerRight.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizingRight = true;
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (isResizingRight) {
            const newWidth = window.innerWidth - e.clientX - 10;
            if (newWidth > 200 && newWidth < 800) {
                document.getElementById('logs-container').style.width = `${newWidth}px`;
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingRight) {
            isResizingRight = false;
            document.body.style.userSelect = '';
        }
    });
}

// Функция инициализации всех контролов
function initializeControls() {
    setupAnimationSpeedControl();
    setupAnimationModeControl();
    setupCompletedLogsClick();
    setupToggleButtons();
    setupZoomControl();
    setupResizers();
}

// Инициализация Cytoscape и контролов после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    loadData();
});

// Интервал обновления лога событий
setInterval(updateEventLog, 1000);
