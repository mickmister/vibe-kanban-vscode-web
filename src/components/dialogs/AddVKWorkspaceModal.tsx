import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Spinner,
} from '@heroui/react';

interface TaskAttempt {
  id: string;
  name: string;
  container_ref: string | null;
  branch: string;
  archived: boolean;
  pinned: boolean;
  agent_working_dir: string | null;
}

interface AddVKWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (taskAttemptId: string, name: string, containerRef: string) => void;
}

export function AddVKWorkspaceModal({
  isOpen,
  onClose,
  onAdd,
}: AddVKWorkspaceModalProps) {
  const [taskAttempts, setTaskAttempts] = useState<TaskAttempt[]>([]);
  const [filteredAttempts, setFilteredAttempts] = useState<TaskAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchTaskAttempts();
    } else {
      // Reset state when modal closes
      setSearchQuery('');
      setSelectedId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    // Filter task attempts based on search query
    if (!searchQuery.trim()) {
      setFilteredAttempts(taskAttempts);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredAttempts(
        taskAttempts.filter(
          (ta) =>
            ta.name?.toLowerCase().includes(query) ||
            ta.branch?.toLowerCase().includes(query) ||
            ta.agent_working_dir?.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, taskAttempts]);

  const fetchTaskAttempts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${window.location.origin}/api/task-attempts`);
      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        // Filter out archived by default, sort by pinned then name
        const workspaces = data.data
          .filter((ta: TaskAttempt) => !ta.archived)
          .sort((a: TaskAttempt, b: TaskAttempt) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return (a.name || '').localeCompare(b.name || '');
          });
        setTaskAttempts(workspaces);
        setFilteredAttempts(workspaces);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    const selected = taskAttempts.find((ta) => ta.id === selectedId);
    if (!selected) return;

    const containerRef =
      selected.container_ref || `/var/tmp/vibe-kanban/worktrees/${selected.branch.slice(3)}`;

    onAdd(selected.id, selected.name || 'Untitled Workspace', containerRef);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Add VK Workspace</h2>
          <p className="text-sm text-neutral-400 font-normal">
            Select a workspace to open in split view (Kanban + Code)
          </p>
        </ModalHeader>
        <ModalBody>
          <Input
            placeholder="Search workspaces..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="sm"
            classNames={{
              inputWrapper: 'bg-neutral-800',
            }}
          />

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Spinner size="lg" />
            </div>
          )}

          {error && (
            <div className="text-red-400 text-sm p-4 bg-red-500/10 rounded">
              {error}
            </div>
          )}

          {!loading && !error && filteredAttempts.length === 0 && (
            <div className="text-neutral-500 text-center py-8">
              {searchQuery
                ? 'No workspaces match your search'
                : 'No workspaces available'}
            </div>
          )}

          {!loading && !error && filteredAttempts.length > 0 && (
            <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
              {filteredAttempts.map((ta) => (
                <div
                  key={ta.id}
                  onClick={() => setSelectedId(ta.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedId === ta.id
                      ? 'bg-primary-500/20 border border-primary-500'
                      : 'bg-neutral-800 hover:bg-neutral-700 border border-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {ta.pinned && <span className="text-yellow-500">📌</span>}
                        <h3 className="font-medium text-sm truncate">
                          {ta.name || 'Untitled'}
                        </h3>
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        Branch: {ta.branch}
                      </p>
                      {ta.agent_working_dir && (
                        <p className="text-xs text-neutral-500 mt-0.5">
                          Dir: {ta.agent_working_dir}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="default" variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button
            color="primary"
            onPress={handleAdd}
            isDisabled={!selectedId || loading}
          >
            Add Workspace
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
