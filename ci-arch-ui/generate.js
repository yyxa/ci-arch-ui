const fs = require('fs');
const path = require('path');
const { DOMParser } = require('@xmldom/xmldom');
const process = require('process');

function parseXML(xmlPath) {
    const xmlString = fs.readFileSync(xmlPath, 'utf8');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

    const nodes = [];
    const edges = [];
    const mapping = {};

    const cellElements = xmlDoc.getElementsByTagName('mxCell');

    for (let cell of cellElements) {
        const id = cell.getAttribute('id');
        const value = cell.getAttribute('value') || '';
        const style = cell.getAttribute('style') || '';
        const source = cell.getAttribute('source');
        const target = cell.getAttribute('target');
        const geometry = cell.getElementsByTagName('mxGeometry')[0];

        if (!source && !target && geometry) {
            const x = parseFloat(geometry.getAttribute('x') || 0);
            const y = parseFloat(geometry.getAttribute('y') || 0);
            const width = parseFloat(geometry.getAttribute('width') || 50);
            const height = parseFloat(geometry.getAttribute('height') || 50);

            nodes.push({
                id,
                label: value,
                color: getStyleProperty(style, 'fillColor', '#cccccc'),
                shape: getShapeFromStyle(style),
                width,
                height,
                position: { x, y },
            });

            if (value) {
                mapping[value] = ""; // Placeholder for Kafka mapping
            }
        } else if (source && target) {
            edges.push({
                id,
                source,
                target,
                label: value,
                lineColor: getStyleProperty(style, 'strokeColor', '#888888'),
                curveStyle: style.includes('orthogonalEdgeStyle') ? 'straight' : 'bezier',
            });
        }
    }

    // Сохранение в файлы
    fs.writeFileSync('objects.json', JSON.stringify({ nodes, edges }, null, 2));
    fs.writeFileSync('mapping.json', JSON.stringify(mapping, null, 2));

    console.log('Файлы objects.json и mapping.json успешно созданы.');
}

function getStyleProperty(style, property, defaultValue) {
    const regex = new RegExp(`${property}=([^;]+)`);
    const match = style.match(regex);
    return match ? match[1] : defaultValue;
}

function getShapeFromStyle(style) {
    if (style.includes('ellipse')) return 'ellipse';
    if (style.includes('rounded')) return 'round-rectangle';
    if (style.includes('umlActor')) return 'triangle';
    return 'rectangle';
}

// Проверка аргумента
const xmlFilePath = process.argv[2];
if (!xmlFilePath) {
    console.error('Укажите путь к XML файлу в качестве аргумента.');
    process.exit(1);
}

if (!fs.existsSync(xmlFilePath)) {
    console.error(`Файл ${xmlFilePath} не найден.`);
    process.exit(1);
}

// Запуск парсинга
parseXML(xmlFilePath);
