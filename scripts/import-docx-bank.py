#!/usr/bin/env python3
import argparse
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

MARKER_RE = re.compile(r'(?<!\d)(\d+)\s*/\s*500\s*(.*)$')
ANSWER_RE = re.compile(r'[\uff08(]\s*(?:\u9009\u9879)?\s*([A-Ea-e]+)\s*[\uff09)]?')
OPTION_RE = re.compile(r'^([A-E])(?:[\.\u3001:\uff1a]|\s{1,}|(?=[\u4e00-\u9fff0-9]))(.*)$')
POST_FIXES = {
    '13': {'options': {'E': '????????????'}},
    '119': {'stem': '????'},
    '183': {'options': {'C': '??'}},
    '339': {'options': {'B': '???????'}},
    '358': {'options': {'B': '????'}},
    '403': {'options': {'C': '???????'}},
    '418': {'options': {'C': '?????'}},
    '430': {'options': {'B': '????????'}},
}
CONTINUATION_PREFIXES = ('\u7684', '\uff0c', '\u3002', '\uff1b', '\uff09', ')')
IGNORED_LINES = []


def read_paragraphs(path: Path) -> list[str]:
    with zipfile.ZipFile(path) as archive:
        xml = archive.read('word/document.xml')
    root = ET.fromstring(xml)
    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    paragraphs = []
    for paragraph in root.findall('.//w:p', ns):
        text = ''.join(node.text or '' for node in paragraph.findall('.//w:t', ns)).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def normalize_marker(number: int) -> int:
    return 448 if number == 548 else number


def split_blocks(paragraphs: list[str]):
    marker_positions = []
    for index, paragraph in enumerate(paragraphs):
        match = MARKER_RE.search(paragraph)
        if match:
            marker_positions.append((index, normalize_marker(int(match.group(1)))))
    marker_positions.sort(key=lambda item: item[0])

    blocks = []
    seen_numbers = {number for _, number in marker_positions}
    for position, (start, number) in enumerate(marker_positions):
        end = marker_positions[position + 1][0] if position + 1 < len(marker_positions) else len(paragraphs)
        block = paragraphs[start:end]
        answer_lines = []
        for offset, line in enumerate(block[1:], start=1):
            if OPTION_RE.match(line):
                continue
            if ANSWER_RE.search(line):
                answer_lines.append(offset)
        if len(answer_lines) > 1:
            missing = [candidate for candidate in range(number + 1, 501) if candidate not in seen_numbers]
            previous = 1
            for new_number, split_at in zip(missing, answer_lines[1:]):
                blocks.append((start + previous, number, block[previous:split_at]))
                number = new_number
                previous = split_at
            blocks.append((start + previous, number, block[previous:]))
        else:
            blocks.append((start, number, block))
    return blocks


def is_continuation(line: str) -> bool:
    return line.startswith(CONTINUATION_PREFIXES)


def parse_question(number: int, block: list[str]) -> dict:
    stem_index = None
    for index, line in enumerate(block):
        if MARKER_RE.search(line) or OPTION_RE.match(line):
            continue
        if ANSWER_RE.search(line):
            stem_index = index
            break
    answer_override = None
    if stem_index is None:
        for index in range(1, len(block)):
            if not OPTION_RE.match(block[index]):
                stem_index = index
                break
        if stem_index is None:
            raise ValueError(f'Question {number} has no stem')
        option_answers = []
        for line in block[stem_index + 1:]:
            if OPTION_RE.match(line):
                option_answers.extend(value.upper() for value in ANSWER_RE.findall(line))
        if len(option_answers) != 1:
            raise ValueError(f'Question {number} has no reliable answer')
        answer_override = option_answers[0]

    stem_line = block[stem_index]
    answer_match = ANSWER_RE.search(stem_line)
    if answer_match:
        answer = answer_match.group(1).upper()
        stem = ANSWER_RE.sub('', stem_line).strip().rstrip('?;?,?')
    elif answer_override:
        answer = answer_override
        stem = stem_line.strip().rstrip('?;?,?')
    else:
        raise ValueError(f'Question {number} has no answer')
    if number == 365:
        answer = 'D'
    options = {}
    pending = []

    def assign_pending_before(next_key: str) -> None:
        nonlocal pending
        if not pending:
            return
        missing = [key for key in 'ABCDE' if key not in options and key < next_key]
        continuation = [line for line in pending if is_continuation(line)]
        regular = [line for line in pending if not is_continuation(line)]
        if continuation and not regular and len(missing) == 1:
            key = missing[0]
            options[key] = options.get(key, '') + ''.join(continuation)
            pending = []
            return
        if len(regular) > len(missing):
            IGNORED_LINES.extend((number, line) for line in regular[len(missing):])
            regular = regular[:len(missing)]
        for key, text in zip(missing, regular):
            options[key] = text
        pending = continuation

    for line in block[stem_index + 1:]:
        if not line:
            continue
        match = OPTION_RE.match(line)
        if match:
            key = match.group(1).upper()
            assign_pending_before(key)
            text = match.group(2).strip()
            if answer_override:
                text = ANSWER_RE.sub('', text).strip()
            if key in options:
                options[key] = options[key] + text
            else:
                options[key] = text
        else:
            pending.append(line.strip())

    if pending:
        missing = [key for key in 'ABCDE' if key not in options]
        if len(pending) > len(missing):
            IGNORED_LINES.extend((number, line) for line in pending[len(missing):])
            pending = pending[:len(missing)]
        for key, text in zip(missing, pending):
            options[key] = text

    fix = POST_FIXES.get(str(number))
    if fix:
        if fix.get('stem'):
            stem = stem + fix['stem']
        for key, suffix in fix.get('options', {}).items():
            if key not in options:
                raise ValueError(f'Question {number} post-fix option {key} is missing')
            options[key] = options[key] + suffix

    ordered_keys = [key for key in 'ABCDE' if key in options]
    if len(ordered_keys) < 2:
        raise ValueError(f'Question {number} has too few options')
    if answer not in ordered_keys:
        raise ValueError(f'Question {number} answer {answer} is not in options')

    option_items = [{'key': key, 'text': options[key]} for key in ordered_keys]
    answer_text = '；'.join(item['text'] for item in option_items if item['key'] == answer)

    return {
        'id': str(number),
        'type': 'single',
        'stem': stem,
        'options': option_items,
        'answer': [answer],
        'answerText': answer_text,
        'explanation': '',
        'explanationSource': 'ai',
        'searchTerms': [],
        'revision': 1,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    paragraphs = read_paragraphs(Path(args.input))
    blocks = split_blocks(paragraphs)
    questions = [parse_question(number, block) for _, number, block in blocks]
    questions.sort(key=lambda item: int(item['id']))

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(questions, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    ids = [int(question['id']) for question in questions]
    print('questions', len(questions))
    print('first_id', min(ids), 'last_id', max(ids))
    print('missing', [number for number in range(1, 501) if number not in set(ids)])
    print('duplicate_ids', len(ids) - len(set(ids)))
    print('answers', sorted({question['answer'][0] for question in questions}))
    print('option_counts', sorted({len(question['options']) for question in questions}))
    print('ignored_lines', len(IGNORED_LINES))
    for number, line in IGNORED_LINES[:40]:
        print(f'ignored q{number}:', line)


if __name__ == '__main__':
    main()
