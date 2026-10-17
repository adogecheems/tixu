import { ApiError } from '../errors.js';
import { parseJson } from '../utils.js';

function normalizedText(value, config) {
  let result = String(value ?? '');
  if (config.trimWhitespace !== false) result = result.trim();
  if (config.collapseWhitespace) result = result.replace(/\s+/g, ' ');
  if (!config.caseSensitive) result = result.toLowerCase();
  return result;
}

export async function getVersionSnapshot(db, versionId) {
  return db
    .prepare(
      `SELECT v.*, qa.answer_json, qa.judge_config_json, q.status AS question_status,
              q.current_version_id, c.name AS category_name, c.parent_id AS category_parent_id,
              parent.name AS parent_category_name
       FROM question_versions v
       JOIN questions q ON q.id = v.question_id
       JOIN question_answers qa ON qa.version_id = v.id
       LEFT JOIN categories c ON c.id = v.category_id
       LEFT JOIN categories parent ON parent.id = c.parent_id
       WHERE v.id = ?`,
    )
    .get(versionId);
}

export function normalizeSubmittedAnswer(versionRow, submitted) {
  const type = versionRow.question_type;
  const input = submitted && typeof submitted === 'object' ? submitted : {};
  const options = parseJson(versionRow.options_json, []);
  const errors = [];

  if (type === 'single') {
    const optionId = String(input.optionId || '').trim();
    if (!optionId) errors.push({ field: 'answer.optionId', message: '请选择一个选项。' });
    else if (!options.some((option) => String(option.id) === optionId)) {
      errors.push({ field: 'answer.optionId', message: '所选选项无效。' });
    }
    if (errors.length) throw new ApiError(422, 'VALIDATION_FAILED', '请选择有效答案后再提交。', errors);
    return { optionId };
  }

  if (type === 'multiple') {
    const optionIds = Array.isArray(input.optionIds)
      ? [...new Set(input.optionIds.map((value) => String(value).trim()).filter(Boolean))]
      : [];
    if (!optionIds.length) {
      throw new ApiError(422, 'VALIDATION_FAILED', '请至少选择一个选项。', [
        { field: 'answer.optionIds', message: '请至少选择一个选项。' },
      ]);
    }
    if (optionIds.some((id) => !options.some((option) => String(option.id) === id))) {
      throw new ApiError(422, 'VALIDATION_FAILED', '答案包含无效选项。', [
        { field: 'answer.optionIds', message: '答案包含无效选项。' },
      ]);
    }
    return { optionIds: optionIds.sort() };
  }

  if (type === 'truefalse') {
    if (typeof input.value !== 'boolean') {
      throw new ApiError(422, 'VALIDATION_FAILED', '请选择“正确”或“错误”。', [
        { field: 'answer.value', message: '请选择“正确”或“错误”。' },
      ]);
    }
    return { value: input.value };
  }

  if (type === 'fill') {
    const config = parseJson(versionRow.judge_config_json, {});
    const count = Number(config.blankCount) || (Array.isArray(config.blanks) ? config.blanks.length : 1);
    const values = Array.isArray(input.blanks) ? input.blanks.slice(0, count) : [];
    if (values.length !== count) {
      throw new ApiError(422, 'VALIDATION_FAILED', '请完成每个填空后再提交。', [
        { field: 'answer.blanks', message: '填空数量不匹配。' },
      ]);
    }
    return { blanks: values.map((value) => String(value ?? '').slice(0, 1000)) };
  }

  if (type === 'essay') {
    const textValue = String(input.text ?? '').slice(0, 20000);
    if (!textValue.trim()) {
      throw new ApiError(422, 'VALIDATION_FAILED', '请先写下你的答案。', [
        { field: 'answer.text', message: '答案不能为空。' },
      ]);
    }
    return { text: textValue };
  }

  throw new ApiError(422, 'VALIDATION_FAILED', '未知题型。');
}

export function judgeAnswer(versionRow, submitted) {
  const storedAnswer = parseJson(versionRow.answer_json, {});
  const config = parseJson(versionRow.judge_config_json, {});
  const type = versionRow.question_type;
  const normalized = normalizeSubmittedAnswer(versionRow, submitted);

  if (type === 'essay') {
    return {
      normalizedAnswer: normalized,
      isCorrect: null,
      requiresSelfAssessment: true,
      correctAnswer: { referenceMarkdown: String(storedAnswer.referenceMarkdown || '') },
    };
  }

  let isCorrect = false;
  if (type === 'single') {
    isCorrect = normalized.optionId === String(storedAnswer.optionId || '');
  } else if (type === 'multiple') {
    const expected = [...new Set((storedAnswer.optionIds || []).map(String))].sort();
    isCorrect =
      expected.length === normalized.optionIds.length &&
      expected.every((value, index) => value === normalized.optionIds[index]);
  } else if (type === 'truefalse') {
    isCorrect = normalized.value === Boolean(storedAnswer.value);
  } else if (type === 'fill') {
    const accepted = Array.isArray(storedAnswer.blanks) ? storedAnswer.blanks : [];
    isCorrect =
      accepted.length === normalized.blanks.length &&
      accepted.every((answers, index) => {
        const submittedValue = normalizedText(normalized.blanks[index], config);
        return (answers || []).some(
          (acceptedValue) => normalizedText(acceptedValue, config) === submittedValue,
        );
      });
  }

  return {
    normalizedAnswer: normalized,
    isCorrect,
    requiresSelfAssessment: false,
    correctAnswer: storedAnswer,
  };
}

export function answerTextSummary(type, answer) {
  if (!answer || typeof answer !== 'object') return '';
  if (type === 'single') return String(answer.optionId || '');
  if (type === 'multiple') return (answer.optionIds || []).join('、');
  if (type === 'truefalse') return answer.value === true ? '正确' : answer.value === false ? '错误' : '';
  if (type === 'fill') return (answer.blanks || []).map((value, index) => `第${index + 1}空：${value || '（空）'}`).join('；');
  if (type === 'essay') return String(answer.text || '').slice(0, 120);
  return '';
}
