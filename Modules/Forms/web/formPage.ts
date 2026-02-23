import { FormQuestion, FormData } from '../helpers';

interface GuildInfo {
  name: string;
  iconUrl?: string;
  color?: string;
}

export function generateFormHTML(form: FormData, guildInfo: GuildInfo): string {
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const accentColor = guildInfo.color || '#5865F2';

  const questionHTML = form.questions
    .map((q, index) => generateQuestionHTML(q, index))
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(form.name)} - Form</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .container {
      max-width: 600px;
      width: 100%;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }

    .header {
      background: ${accentColor};
      color: white;
      padding: 30px 20px;
      text-align: center;
    }

    .header-guild {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-bottom: 15px;
      font-size: 14px;
      opacity: 0.9;
    }

    .guild-icon {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
    }

    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .header p {
      opacity: 0.9;
      font-size: 14px;
      line-height: 1.5;
    }

    .content {
      padding: 30px;
    }

    .form-group {
      margin-bottom: 25px;
    }

    .form-group:last-of-type {
      margin-bottom: 0;
    }

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #2c2f33;
      font-size: 14px;
    }

    .required {
      color: #ff0000;
      margin-left: 4px;
    }

    input[type="text"],
    input[type="email"],
    input[type="url"],
    input[type="number"],
    textarea,
    select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-family: inherit;
      font-size: 14px;
      transition: border-color 0.2s;
    }

    input[type="text"]:focus,
    input[type="email"]:focus,
    input[type="url"]:focus,
    input[type="number"]:focus,
    textarea:focus,
    select:focus {
      outline: none;
      border-color: ${accentColor};
      box-shadow: 0 0 0 3px ${accentColor}20;
    }

    textarea {
      resize: vertical;
      min-height: 100px;
    }

    .radio-group,
    .checkbox-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .radio-option,
    .checkbox-option {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    input[type="radio"],
    input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: ${accentColor};
    }

    .radio-option label,
    .checkbox-option label {
      margin-bottom: 0;
      margin-top: 2px;
      cursor: pointer;
      font-weight: normal;
    }

    .helper-text {
      font-size: 12px;
      color: #999;
      margin-top: 6px;
    }

    .error {
      color: #ff0000;
      font-size: 12px;
      margin-top: 6px;
      display: none;
    }

    .error.show {
      display: block;
    }

    .form-group.has-error input,
    .form-group.has-error textarea,
    .form-group.has-error select {
      border-color: #ff0000;
    }

    .buttons {
      display: flex;
      gap: 10px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }

    button {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-submit {
      background: ${accentColor};
      color: white;
    }

    .btn-submit:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px ${accentColor}40;
    }

    .btn-submit:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    .btn-reset {
      background: #eee;
      color: #2c2f33;
    }

    .btn-reset:hover {
      background: #ddd;
    }

    .success-message {
      background: #d4edda;
      color: #155724;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: none;
    }

    .success-message.show {
      display: block;
    }

    .error-message {
      background: #f8d7da;
      color: #721c24;
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: none;
    }

    .error-message.show {
      display: block;
    }

    @media (max-width: 600px) {
      .header h1 {
        font-size: 24px;
      }

      .content {
        padding: 20px;
      }

      .buttons {
        flex-direction: column;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-guild">
        ${guildInfo.iconUrl ? `<img src="${guildInfo.iconUrl}" alt="Guild Icon" class="guild-icon">` : '<div class="guild-icon"></div>'}
        <span>${escapeHtml(guildInfo.name)}</span>
      </div>
      <h1>${escapeHtml(form.name)}</h1>
      ${form.description ? `<p>${escapeHtml(form.description)}</p>` : ''}
    </div>

    <div class="content">
      <div class="success-message" id="successMessage">
        ✅ Your response has been submitted successfully!
      </div>
      <div class="error-message" id="errorMessage"></div>

      <form id="responseForm">
        ${questionHTML}

        <div class="buttons">
          <button type="submit" class="btn-submit" id="submitBtn">Submit Response</button>
          <button type="reset" class="btn-reset">Clear Form</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const form = document.getElementById('responseForm');
    const submitBtn = document.getElementById('submitBtn');
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validate form
      const isValid = validateForm();
      if (!isValid) {
        return;
      }

      // Collect form data
      const formData = new FormData(form);
      const answers = {};

      formData.forEach((value, key) => {
        if (key.startsWith('question_')) {
          const questionLabel = key.replace('question_', '');
          if (answers[questionLabel]) {
            // Handle multiple values (checkboxes)
            if (!Array.isArray(answers[questionLabel])) {
              answers[questionLabel] = [answers[questionLabel]];
            }
            answers[questionLabel].push(value);
          } else {
            answers[questionLabel] = value;
          }
        }
      });

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        const response = await fetch(window.location.pathname, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(answers),
        });

        const data = await response.json();

        if (response.ok) {
          form.reset();
          successMessage.classList.add('show');
          errorMessage.classList.remove('show');
          
          // Hide success message after 5 seconds
          setTimeout(() => {
            successMessage.classList.remove('show');
          }, 5000);
        } else {
          errorMessage.textContent = '❌ ' + (data.message || 'An error occurred while submitting the form.');
          errorMessage.classList.add('show');
        }
      } catch (error) {
        errorMessage.textContent = '❌ An error occurred while submitting the form.';
        errorMessage.classList.add('show');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Response';
      }
    });

    function validateForm() {
      let isValid = true;
      const formGroups = document.querySelectorAll('.form-group');

      formGroups.forEach((group) => {
        const input = group.querySelector('input, textarea, select');
        const error = group.querySelector('.error');
        const label = group.querySelector('label').textContent;

        if (!input) return;

        let value = input.value.trim();

        // Check if required
        if (input.hasAttribute('required') && !value) {
          showError(group, 'This field is required');
          isValid = false;
        } else {
          // Validate based on type
          if (input.type === 'email' && value) {
            if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
              showError(group, 'Please enter a valid email address');
              isValid = false;
            } else {
              hideError(group);
            }
          } else if (input.type === 'url' && value) {
            try {
              new URL(value);
              hideError(group);
            } catch {
              showError(group, 'Please enter a valid URL');
              isValid = false;
            }
          } else if (input.type === 'number' && value) {
            const num = parseFloat(value);
            const min = input.min ? parseFloat(input.min) : null;
            const max = input.max ? parseFloat(input.max) : null;

            if (isNaN(num)) {
              showError(group, 'Please enter a valid number');
              isValid = false;
            } else if (min !== null && num < min) {
              showError(group, 'Value must be at least ' + min);
              isValid = false;
            } else if (max !== null && num > max) {
              showError(group, 'Value must be at most ' + max);
              isValid = false;
            } else {
              hideError(group);
            }
          } else if (input.minLength && value.length < input.minLength) {
            showError(group, 'Minimum ' + input.minLength + ' characters required');
            isValid = false;
          } else if (input.maxLength && value.length > input.maxLength) {
            showError(group, 'Maximum ' + input.maxLength + ' characters allowed');
            isValid = false;
          } else {
            hideError(group);
          }
        }
      });

      return isValid;
    }

    function showError(group, message) {
      group.classList.add('has-error');
      const error = group.querySelector('.error');
      if (error) {
        error.textContent = message;
        error.classList.add('show');
      }
    }

    function hideError(group) {
      group.classList.remove('has-error');
      const error = group.querySelector('.error');
      if (error) {
        error.classList.remove('show');
      }
    }
  </script>
</body>
</html>`;
}

function generateQuestionHTML(question: FormQuestion, index: number): string {
  const required = question.required ? '<span class="required">*</span>' : '';
  const fieldName = `question_${question.label}`;

  let inputHTML = '';

  switch (question.type) {
    case 'short_text':
      inputHTML = `<input 
        type="text" 
        name="${fieldName}" 
        placeholder="${escapeHtml(question.placeholder || '')}"
        ${question.required ? 'required' : ''}
        ${question.minLength ? `minlength="${question.minLength}"` : ''}
        ${question.maxLength ? `maxlength="${question.maxLength}"` : ''}
      />`;
      if (question.minLength || question.maxLength) {
        inputHTML += `<div class="helper-text">${question.minLength ? `Min: ${question.minLength}` : ''} ${question.maxLength ? `Max: ${question.maxLength}` : ''}</div>`;
      }
      break;

    case 'long_text':
      inputHTML = `<textarea 
        name="${fieldName}" 
        placeholder="${escapeHtml(question.placeholder || '')}"
        ${question.required ? 'required' : ''}
        ${question.minLength ? `minlength="${question.minLength}"` : ''}
        ${question.maxLength ? `maxlength="${question.maxLength}"` : ''}
      ></textarea>`;
      if (question.minLength || question.maxLength) {
        inputHTML += `<div class="helper-text">${question.minLength ? `Min: ${question.minLength}` : ''} ${question.maxLength ? `Max: ${question.maxLength}` : ''}</div>`;
      }
      break;

    case 'email':
      inputHTML = `<input 
        type="email" 
        name="${fieldName}" 
        placeholder="${escapeHtml(question.placeholder || 'email@example.com')}"
        ${question.required ? 'required' : ''}
      />`;
      break;

    case 'url':
      inputHTML = `<input 
        type="url" 
        name="${fieldName}" 
        placeholder="${escapeHtml(question.placeholder || 'https://example.com')}"
        ${question.required ? 'required' : ''}
      />`;
      break;

    case 'number':
      inputHTML = `<input 
        type="number" 
        name="${fieldName}" 
        placeholder="${escapeHtml(question.placeholder || '')}"
        ${question.required ? 'required' : ''}
        ${question.min !== undefined ? `min="${question.min}"` : ''}
        ${question.max !== undefined ? `max="${question.max}"` : ''}
      />`;
      if (question.min !== undefined || question.max !== undefined) {
        inputHTML += `<div class="helper-text">${question.min !== undefined ? `Min: ${question.min}` : ''} ${question.max !== undefined ? `Max: ${question.max}` : ''}</div>`;
      }
      break;

    case 'multiple_choice':
      inputHTML = `<div class="radio-group">
        ${question.options
          ?.map(
            (opt) => `
          <div class="radio-option">
            <input type="radio" id="${fieldName}_${escapeHtml(opt)}" name="${fieldName}" value="${escapeHtml(opt)}" ${question.required ? 'required' : ''} />
            <label for="${fieldName}_${escapeHtml(opt)}">${escapeHtml(opt)}</label>
          </div>
        `
          )
          .join('')}
      </div>`;
      break;

    case 'checkbox':
      inputHTML = `<input 
        type="checkbox" 
        name="${fieldName}" 
        value="true"
      />`;
      break;

    case 'dropdown':
      inputHTML = `<select name="${fieldName}" ${question.required ? 'required' : ''}>
        <option value="">Select an option...</option>
        ${question.options?.map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
      </select>`;
      break;
  }

  return `
    <div class="form-group">
      <label for="${fieldName}">${escapeHtml(question.label)}${required}</label>
      ${inputHTML}
      <div class="error"></div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
