'use client';

import React, { useState } from 'react';
import {
    FileText,
    Plus,
    Trash2,
    Copy,
    Star,
    Edit2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

interface TemplateSection {
    id: string;
    name: string;
    enabled: boolean;
    order: number;
    prompt?: string;
}

interface Template {
    id: string;
    name: string;
    description?: string;
    format: string;
    sections: TemplateSection[];
    isDefault?: boolean;
    isSystem?: boolean;
}

interface TemplateManagerProps {
    userTemplates: Template[];
    systemTemplates: Template[];
    onCreateTemplate: (template: Omit<Template, 'id'>) => Promise<void>;
    onUpdateTemplate: (id: string, template: Partial<Template>) => Promise<void>;
    onDeleteTemplate: (id: string) => Promise<void>;
    onDuplicateTemplate: (id: string) => Promise<void>;
    onSelectTemplate: (template: Template) => void;
    selectedTemplateId?: string;
}

export function TemplateManager({
    userTemplates,
    systemTemplates,
    // onCreateTemplate,
    // onUpdateTemplate,
    onDeleteTemplate,
    onDuplicateTemplate,
    onSelectTemplate,
    selectedTemplateId,
}: TemplateManagerProps) {
    const [expandedSection, setExpandedSection] = useState<'system' | 'user' | null>('system');
    // const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
    // const [isCreating, setIsCreating] = useState(false);

    const renderTemplateCard = (template: Template, isSystem: boolean) => {
        const isSelected = selectedTemplateId === template.id;

        return (
            <div
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className={`
                    p-3 rounded-lg border cursor-pointer transition-all
                    ${isSelected
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-border bg-surface hover:bg-surface-hover'
                    }
                `}
            >
                <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className={isSelected ? 'text-primary' : 'text-text-muted'} />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-medium text-sm text-text-main">
                                    {template.name}
                                </span>
                                {template.isDefault && (
                                    <Star size={12} className="text-yellow-500 fill-yellow-500" />
                                )}
                            </div>
                            {template.description && (
                                <p className="text-xs text-text-muted mt-0.5">
                                    {template.description}
                                </p>
                            )}
                        </div>
                    </div>
                    {!isSystem && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDuplicateTemplate(template.id);
                                }}
                                className="p-1 text-text-muted hover:text-primary transition-colors"
                                title="Duplicate"
                            >
                                <Copy size={12} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // setEditingTemplate(template);
                                }}
                                className="p-1 text-text-muted hover:text-primary transition-colors"
                                title="Edit"
                            >
                                <Edit2 size={12} />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteTemplate(template.id);
                                }}
                                className="p-1 text-text-muted hover:text-red-500 transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    )}
                    {isSystem && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateTemplate(template.id);
                            }}
                            className="p-1 text-text-muted hover:text-primary transition-colors"
                            title="Copy to My Templates"
                        >
                            <Copy size={12} />
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap gap-1">
                    {template.sections
                        .filter(s => s.enabled)
                        .slice(0, 3)
                        .map(section => (
                            <span
                                key={section.id}
                                className="px-1.5 py-0.5 text-[10px] bg-background rounded text-text-muted"
                            >
                                {section.name}
                            </span>
                        ))}
                    {template.sections.filter(s => s.enabled).length > 3 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-background rounded text-text-muted">
                            +{template.sections.filter(s => s.enabled).length - 3} more
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="p-3 border-b border-border bg-background-secondary flex items-center justify-between">
                <span className="font-semibold text-sm text-text-main">Minutes Templates</span>
                <button
                    onClick={() => { }} // setIsCreating(true)}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors"
                >
                    <Plus size={12} />
                    New
                </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
                {/* System Templates */}
                <div className="border-b border-border">
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'system' ? null : 'system')}
                        className="w-full px-3 py-2 flex items-center justify-between bg-surface-hover hover:bg-surface-hover/80 text-sm"
                    >
                        <span className="text-text-muted font-medium">Built-in Templates</span>
                        {expandedSection === 'system' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedSection === 'system' && (
                        <div className="p-2 space-y-2">
                            {systemTemplates.map(t => renderTemplateCard({ ...t, isSystem: true }, true))}
                        </div>
                    )}
                </div>

                {/* User Templates */}
                <div>
                    <button
                        onClick={() => setExpandedSection(expandedSection === 'user' ? null : 'user')}
                        className="w-full px-3 py-2 flex items-center justify-between bg-surface-hover hover:bg-surface-hover/80 text-sm"
                    >
                        <span className="text-text-muted font-medium">My Templates ({userTemplates.length})</span>
                        {expandedSection === 'user' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {expandedSection === 'user' && (
                        <div className="p-2 space-y-2">
                            {userTemplates.length === 0 ? (
                                <p className="text-xs text-text-muted text-center py-4">
                                    No custom templates yet. Create one or duplicate a built-in template.
                                </p>
                            ) : (
                                userTemplates.map(t => renderTemplateCard(t, false))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
