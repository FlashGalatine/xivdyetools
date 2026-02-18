import { BaseComponent } from './base-component';

export interface ToolHeaderOptions {
  title: string;
  description?: string;
  icon?: string;
  actions?: HTMLElement[];
}

export class ToolHeader extends BaseComponent {
  private options: ToolHeaderOptions;

  constructor(container: HTMLElement, options: ToolHeaderOptions) {
    super(container);
    this.options = options;
  }

  renderContent(): void {
    const header = this.createElement('div', {
      className: 'space-y-4 text-center mb-8',
    });

    const titleContent = this.options.icon
      ? `${this.options.icon} ${this.options.title}`
      : this.options.title;

    const title = this.createElement('h2', {
      className:
        'text-2xl font-bold text-gray-900 dark:text-white flex items-center justify-center gap-2',
      textContent: titleContent,
    });

    header.appendChild(title);

    if (this.options.description) {
      const desc = this.createElement('p', {
        className: 'text-gray-600 dark:text-gray-400 max-w-2xl mx-auto',
        textContent: this.options.description,
      });
      header.appendChild(desc);
    }

    if (this.options.actions && this.options.actions.length > 0) {
      const actionsContainer = this.createElement('div', {
        className: 'flex justify-center gap-2',
      });
      this.options.actions.forEach((action) => actionsContainer.appendChild(action));
      header.appendChild(actionsContainer);
    }

    this.container.appendChild(header);
  }

  bindEvents(): void {
    // No events to bind for ToolHeader
  }
}
