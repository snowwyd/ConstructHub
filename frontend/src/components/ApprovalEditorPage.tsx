import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DoneIcon from '@mui/icons-material/Done';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import EditIcon from '@mui/icons-material/Edit';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
	Alert,
	alpha,
	Box,
	Button,
	Card,
	CardContent,
	CardHeader,
	Chip,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	FormControl,
	FormControlLabel,
	Grid,
	IconButton,
	InputLabel,
	List,
	ListItem,
	ListItemIcon,
	ListItemSecondaryAction,
	ListItemText,
	MenuItem,
	Paper,
	Radio,
	RadioGroup,
	Select,
	Snackbar,
	Tab,
	Tabs,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { axiosFetching, axiosFetchingFiles } from '../api/AxiosFetch';
import config from '../constants/Configurations.json';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';

// Интерфейсы для типизации данных
interface Workflow {
  id: number;
  name: string;
  workflow_length: number;
  description?: string;
  steps?: WorkflowStep[];
  created_at?: string;
  updated_at?: string;
}

interface WorkflowStep {
	id: number;
	workflow_id: number;
	user_id: number | null;
	role_id: number;
	order: number;
	is_final: boolean;
	user_name?: string;
	role_name?: string;
}

interface User {
	id: number;
	login: string;
	role_id: number;
	role_name: string;
}

interface Role {
	id: number;
	name: string;
}

interface FileType {
	id: number;
	name: string;
	extension: string;
}

interface Directory {
	id: number;
	name_folder: string;
	status: string;
	parent_path_id?: number | null;
}

interface AssignmentRule {
	id: number;
	workflow_id: number;
	file_type_id: number | null;
	user_id: number | null;
	role_id: number | null;
	directory_id: number | null;
	file_type_name?: string;
	user_name?: string;
	role_name?: string;
	directory_name?: string;
}

// Эндпоинты
const getWorkflows = config.adminWorkflows || '/admin/workflows';
const getWorkflowById = (id: number) => `${getWorkflows}/${id}`;
const createWorkflow = getWorkflows;
const updateWorkflow = (id: number) => `${getWorkflows}/${id}`;
const deleteWorkflowEndpoint = getWorkflows;
const createStep = `${getWorkflows}/steps`;
const updateStep = (id: number) => `${getWorkflows}/steps/${id}`;
const deleteStep = `${getWorkflows}/steps`;
const getAssignments = `${getWorkflows}`;
const createAssignment = `${getWorkflows}`;
const updateAssignment = (id: number) => `${getWorkflows}/${id}`;
const deleteAssignment = `${getWorkflows}`;
const assignWorkflow = (id: number) => `${getWorkflows}/${id}/assign`;

// Список доступных типов файлов
const fileTypesList: FileType[] = [
	{ id: 1, name: 'Чертеж', extension: 'dwg' },
	{ id: 2, name: '3D Модель', extension: 'glb' },
	{ id: 3, name: 'Документ', extension: 'doc' },
	{ id: 4, name: 'Изображение', extension: 'jpg' },
	{ id: 5, name: 'Таблица', extension: 'xls' },
	{ id: 6, name: 'Презентация', extension: 'ppt' },
	{ id: 7, name: 'PDF-документ', extension: 'pdf' },
];

const ApprovalEditorPage = () => {
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState(0);
	const [snackbar, setSnackbar] = useState({
		open: false,
		message: '',
		severity: 'success' as 'success' | 'error',
	});

	// Состояние для списков и выбранных элементов
	const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(
		null
	);
	const [selectedAssignmentRule, setSelectedAssignmentRule] =
		useState<AssignmentRule | null>(null);

	// Состояние для диалогов
	const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false);
	const [stepDialogOpen, setStepDialogOpen] = useState(false);
	const [deleteWorkflowDialogOpen, setDeleteWorkflowDialogOpen] =
		useState(false);
	const [deleteStepDialogOpen, setDeleteStepDialogOpen] = useState(false);
	const [assignRuleDialogOpen, setAssignRuleDialogOpen] = useState(false);
	const [deleteAssignRuleDialogOpen, setDeleteAssignRuleDialogOpen] =
		useState(false);
	const [viewWorkflowTreeDialogOpen, setViewWorkflowTreeDialogOpen] =
		useState(false);

	// Состояние форм
	const [workflowForm, setWorkflowForm] = useState({
		id: 0,
		name: '',
		description: '',
	});
	const [isEditingWorkflow, setIsEditingWorkflow] = useState(false);

	const [stepForm, setStepForm] = useState({
		id: 0,
		workflow_id: 0,
		user_id: null as number | null,
		role_id: 0,
		order: 0,
		is_final: false,
	});
	const [isEditingStep, setIsEditingStep] = useState(false);

	const [assignRuleForm, setAssignRuleForm] = useState({
		id: 0,
		workflow_id: 0,
		file_type_id: null as number | null,
		user_id: null as number | null,
		role_id: null as number | null,
		directory_id: null as number | null,
		assignment_type: 'all' as
			| 'all'
			| 'user'
			| 'role'
			| 'file_type'
			| 'directory',
	});
	const [isEditingAssignRule, setIsEditingAssignRule] = useState(false);

	// Запросы к API
	const {
		data: workflows,
		isLoading: isWorkflowsLoading,
		isError: isWorkflowsError,
		refetch: refetchWorkflows,
	} = useQuery({
		queryKey: ['admin', 'workflows'],
		queryFn: async () => {
			const response = await axiosFetching.get(getWorkflows);
			// Мапим данные API к интерфейсу Workflow
			return response.data.map((item: any) => ({
				id: item.workflow_id,
				name: item.workflow_name,
				workflow_length: item.workflow_length,
				// Поля, которых нет в ответе API, оставляем undefined
				description: undefined,
				steps: undefined,
				created_at: undefined,
				updated_at: undefined,
			}));
		},
	});

	const { data: users, isLoading: isUsersLoading } = useQuery({
		queryKey: ['admin', 'users'],
		queryFn: async () => {
			const response = await axiosFetching.get('/admin/users');
			return response.data;
		},
	});

	const { data: roles, isLoading: isRolesLoading } = useQuery({
		queryKey: ['admin', 'roles'],
		queryFn: async () => {
			const response = await axiosFetching.get('/admin/roles');
			return response.data;
		},
	});

	const { data: fileTypes, isLoading: isFileTypesLoading } = useQuery({
		queryKey: ['admin', 'fileTypes'],
		queryFn: async () => {
			// В реальном приложении здесь будет запрос к API
			// Сейчас используем заглушку
			return fileTypesList;
		},
	});

	// Запрос директорий для назначения правил
	const { data: directories, isLoading: isDirectoriesLoading } = useQuery({
		queryKey: ['admin', 'directories'],
		queryFn: async () => {
			const response = await axiosFetchingFiles.post('/directories', {
				is_archive: false,
			});
			return response.data;
		},
	});

	const {
		data: assignmentRules,
		isLoading: isAssignmentRulesLoading,
		isError: isAssignmentRulesError,
		refetch: refetchAssignmentRules,
	} = useQuery({
		queryKey: ['admin', 'assignmentRules'],
		queryFn: async () => {
			const response = await axiosFetching.get(getAssignments);
			return response.data;
		},
		enabled: activeTab === 1, // Запрашиваем только когда активна вторая вкладка
	});

	// Запрос для получения дерева директорий привязанных к workflow
	const {
		data: workflowTree,
		isLoading: isWorkflowTreeLoading,
		refetch: refetchWorkflowTree,
	} = useQuery({
		queryKey: ['admin', 'workflowTree', selectedWorkflow?.id],
		queryFn: async () => {
			if (!selectedWorkflow) return null;
			const response = await axiosFetchingFiles.get(
				`/admin/workflows/${selectedWorkflow.id}/tree`
			);
			return response.data;
		},
		enabled: viewWorkflowTreeDialogOpen && !!selectedWorkflow,
	});

	// Мутации для шаблонов согласования
	const createWorkflowMutation = useMutation({
		mutationFn: async (data: { name: string; description: string }) => {
			const response = await axiosFetching.post(createWorkflow, data);
			return response.data;
		},
		onSuccess: data => {
			setSnackbar({
				open: true,
				message: 'Шаблон согласования успешно создан',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'workflows'] });
			setWorkflowDialogOpen(false);
			resetWorkflowForm();

			// Автоматически выбираем созданный шаблон
			if (data && data.id) {
				const newWorkflow = {
					id: data.id,
					name: data.name,
					description: data.description,
					steps: [],
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				};
				setSelectedWorkflow(newWorkflow);
			}
		},
		onError: (error: any) => {
			console.error('Error creating workflow:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при создании шаблона: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const updateWorkflowMutation = useMutation({
		mutationFn: async ({
			workflowId,
			data,
		}: {
			workflowId: number;
			data: { name: string; description: string };
		}) => {
			const response = await axiosFetching.put(
				updateWorkflow(workflowId),
				data
			);
			return response.data;
		},
		onSuccess: (data, variables) => {
			setSnackbar({
				open: true,
				message: 'Шаблон согласования успешно обновлен',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'workflows'] });
			setWorkflowDialogOpen(false);
			resetWorkflowForm();

			// Обновляем выбранный шаблон
			if (selectedWorkflow) {
				setSelectedWorkflow({
					...selectedWorkflow,
					name: variables.data.name,
					description: variables.data.description,
					updated_at: new Date().toISOString(),
				});
			}
		},
		onError: (error: any) => {
			console.error('Error updating workflow:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при обновлении шаблона: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const deleteWorkflowMutation = useMutation({
		mutationFn: async (workflowId: number) => {
			const response = await axiosFetching.delete(deleteWorkflowEndpoint, {
				data: { id: workflowId },
			});
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Шаблон согласования успешно удален',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'workflows'] });
			setDeleteWorkflowDialogOpen(false);
			setSelectedWorkflow(null);
		},
		onError: (error: any) => {
			console.error('Error deleting workflow:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при удалении шаблона: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	// Мутации для этапов согласования
	const createStepMutation = useMutation({
		mutationFn: async (data: {
			workflow_id: number;
			user_id: number | null;
			role_id: number;
			order: number;
			is_final: boolean;
		}) => {
			const response = await axiosFetching.post(createStep, data);
			return response.data;
		},
		onSuccess: data => {
			setSnackbar({
				open: true,
				message: 'Этап согласования успешно добавлен',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'workflows'] });
			setStepDialogOpen(false);
			resetStepForm();

			// Обновляем шаги в выбранном шаблоне
			if (selectedWorkflow) {
				// Получаем обновленные данные шаблона
				fetchWorkflowDetails(selectedWorkflow.id);
			}
		},
		onError: (error: any) => {
			console.error('Error creating step:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при добавлении этапа: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const updateStepMutation = useMutation({
		mutationFn: async ({
			stepId,
			data,
		}: {
			stepId: number;
			data: {
				workflow_id: number;
				user_id: number | null;
				role_id: number;
				order: number;
				is_final: boolean;
			};
		}) => {
			const response = await axiosFetching.put(updateStep(stepId), data);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Этап согласования успешно обновлен',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'workflows'] });
			setStepDialogOpen(false);
			resetStepForm();

			// Обновляем шаги в выбранном шаблоне
			if (selectedWorkflow) {
				// Получаем обновленные данные шаблона
				fetchWorkflowDetails(selectedWorkflow.id);
			}
		},
		onError: (error: any) => {
			console.error('Error updating step:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при обновлении этапа: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const deleteStepMutation = useMutation({
		mutationFn: async (stepId: number) => {
			const response = await axiosFetching.delete(deleteStep, {
				data: { id: stepId },
			});
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Этап согласования успешно удален',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'workflows'] });
			setDeleteStepDialogOpen(false);

			// Обновляем шаги в выбранном шаблоне
			if (selectedWorkflow) {
				// Получаем обновленные данные шаблона
				fetchWorkflowDetails(selectedWorkflow.id);
			}
		},
		onError: (error: any) => {
			console.error('Error deleting step:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при удалении этапа: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	// Мутации для правил назначения
	const createAssignRuleMutation = useMutation({
		mutationFn: async (data: {
			workflow_id: number;
			file_type_id?: number | null;
			user_id?: number | null;
			role_id?: number | null;
			directory_id?: number | null;
		}) => {
			const response = await axiosFetching.post(createAssignment, data);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Правило назначения успешно создано',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'assignmentRules'] });
			setAssignRuleDialogOpen(false);
			resetAssignRuleForm();
		},
		onError: (error: any) => {
			console.error('Error creating assignment rule:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при создании правила: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const updateAssignRuleMutation = useMutation({
		mutationFn: async ({
			ruleId,
			data,
		}: {
			ruleId: number;
			data: {
				workflow_id: number;
				file_type_id?: number | null;
				user_id?: number | null;
				role_id?: number | null;
				directory_id?: number | null;
			};
		}) => {
			const response = await axiosFetching.put(updateAssignment(ruleId), data);
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Правило назначения успешно обновлено',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'assignmentRules'] });
			setAssignRuleDialogOpen(false);
			resetAssignRuleForm();
		},
		onError: (error: any) => {
			console.error('Error updating assignment rule:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при обновлении правила: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	const deleteAssignRuleMutation = useMutation({
		mutationFn: async (ruleId: number) => {
			const response = await axiosFetching.delete(deleteAssignment, {
				data: { id: ruleId },
			});
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Правило назначения успешно удалено',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'assignmentRules'] });
			setDeleteAssignRuleDialogOpen(false);
			setSelectedAssignmentRule(null);
		},
		onError: (error: any) => {
			console.error('Error deleting assignment rule:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при удалении правила: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	// Мутация для назначения workflow на директорию
	const assignWorkflowMutation = useMutation({
		mutationFn: async ({
			workflowId,
			directoryId,
		}: {
			workflowId: number;
			directoryId: number;
		}) => {
			const url = assignWorkflow(workflowId);
			const response = await axiosFetching.put(url, {
				directory_id: directoryId,
			});
			return response.data;
		},
		onSuccess: () => {
			setSnackbar({
				open: true,
				message: 'Шаблон успешно назначен на директорию',
				severity: 'success',
			});
			queryClient.invalidateQueries({ queryKey: ['admin', 'assignmentRules'] });
		},
		onError: (error: any) => {
			console.error('Error assigning workflow to directory:', error);
			setSnackbar({
				open: true,
				message: `Ошибка при назначении шаблона: ${
					error.response?.data?.message || error.message
				}`,
				severity: 'error',
			});
		},
	});

	// Функция для получения детальной информации о workflow
	const fetchWorkflowDetails = async (workflowId: number) => {
		try {
			const response = await axiosFetching.get(getWorkflowById(workflowId));
			const workflowData = response.data;

			// Обновляем выбранный workflow с полученными данными
			setSelectedWorkflow(workflowData);

			return workflowData;
		} catch (error) {
			console.error('Error fetching workflow details:', error);
			setSnackbar({
				open: true,
				message: 'Ошибка при получении данных о шаблоне',
				severity: 'error',
			});
			return null;
		}
	};

	// Вспомогательные функции для сброса форм
	const resetWorkflowForm = () => {
		setWorkflowForm({ id: 0, name: '', description: '' });
		setIsEditingWorkflow(false);
	};

	const resetStepForm = () => {
		setStepForm({
			id: 0,
			workflow_id: selectedWorkflow?.id || 0,
			user_id: null,
			role_id: 0,
			order: selectedWorkflow?.steps?.length
				? selectedWorkflow.steps.length + 1
				: 1,
			is_final: false,
		});
		setIsEditingStep(false);
	};

	const resetAssignRuleForm = () => {
		setAssignRuleForm({
			id: 0,
			workflow_id: 0,
			file_type_id: null,
			user_id: null,
			role_id: null,
			directory_id: null,
			assignment_type: 'all',
		});
		setIsEditingAssignRule(false);
	};

	// Обработчики для вкладок
	const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);

		// Если перешли на вкладку назначения шаблонов, загружаем правила
		if (newValue === 1) {
			refetchAssignmentRules();
		}
	};

	// Обработчики для шаблонов согласования
	const handleCreateWorkflow = () => {
		setIsEditingWorkflow(false);
		resetWorkflowForm();
		setWorkflowDialogOpen(true);
	};

	const handleEditWorkflow = (workflow: Workflow) => {
		setIsEditingWorkflow(true);
		setWorkflowForm({
			id: workflow.id,
			name: workflow.name,
			description: workflow.description,
		});
		setWorkflowDialogOpen(true);
	};

	const handleDeleteWorkflow = () => {
		if (selectedWorkflow) {
			setDeleteWorkflowDialogOpen(true);
		}
	};

	const confirmDeleteWorkflow = () => {
		if (selectedWorkflow) {
			deleteWorkflowMutation.mutate(selectedWorkflow.id);
		}
	};

	const handleWorkflowSelect = async (workflow: Workflow) => {
		// Получаем полную информацию о workflow, включая все шаги
		const workflowDetails = await fetchWorkflowDetails(workflow.id);
		if (workflowDetails) {
			setSelectedWorkflow(workflowDetails);
		}
	};

	const submitWorkflowForm = () => {
		if (isEditingWorkflow) {
			updateWorkflowMutation.mutate({
				workflowId: workflowForm.id,
				data: {
					name: workflowForm.name,
					description: workflowForm.description,
				},
			});
		} else {
			createWorkflowMutation.mutate({
				name: workflowForm.name,
				description: workflowForm.description,
			});
		}
	};

	// Обработчик просмотра дерева директорий для workflow
	const handleViewWorkflowTree = () => {
		if (selectedWorkflow) {
			setViewWorkflowTreeDialogOpen(true);
			refetchWorkflowTree();
		}
	};

	// Обработчики для этапов согласования
	const handleAddStep = () => {
		if (!selectedWorkflow) return;

		setIsEditingStep(false);
		resetStepForm();
		setStepDialogOpen(true);
	};

	const handleEditStep = (step: WorkflowStep) => {
		setIsEditingStep(true);
		setStepForm({
			id: step.id,
			workflow_id: step.workflow_id,
			user_id: step.user_id,
			role_id: step.role_id,
			order: step.order,
			is_final: step.is_final,
		});
		setStepDialogOpen(true);
	};

	const handleDeleteStep = (stepId: number) => {
		setStepForm({ ...stepForm, id: stepId });
		setDeleteStepDialogOpen(true);
	};

	const confirmDeleteStep = () => {
		deleteStepMutation.mutate(stepForm.id);
	};

	const submitStepForm = () => {
		if (isEditingStep) {
			updateStepMutation.mutate({
				stepId: stepForm.id,
				data: {
					workflow_id: stepForm.workflow_id,
					user_id: stepForm.user_id,
					role_id: stepForm.role_id,
					order: stepForm.order,
					is_final: stepForm.is_final,
				},
			});
		} else {
			createStepMutation.mutate({
				workflow_id: stepForm.workflow_id,
				user_id: stepForm.user_id,
				role_id: stepForm.role_id,
				order: stepForm.order,
				is_final: stepForm.is_final,
			});
		}
	};

	// Обработчики для правил назначения
	const handleCreateAssignRule = () => {
		setIsEditingAssignRule(false);
		resetAssignRuleForm();
		setAssignRuleDialogOpen(true);
	};

	const handleEditAssignRule = (rule: AssignmentRule) => {
		setIsEditingAssignRule(true);

		// Определяем тип правила
		let assignmentType: 'all' | 'user' | 'role' | 'file_type' | 'directory' =
			'all';
		if (rule.user_id) assignmentType = 'user';
		else if (rule.role_id) assignmentType = 'role';
		else if (rule.file_type_id) assignmentType = 'file_type';
		else if (rule.directory_id) assignmentType = 'directory';

		setAssignRuleForm({
			id: rule.id,
			workflow_id: rule.workflow_id,
			file_type_id: rule.file_type_id,
			user_id: rule.user_id,
			role_id: rule.role_id,
			directory_id: rule.directory_id,
			assignment_type: assignmentType,
		});
		setAssignRuleDialogOpen(true);
	};

	const handleDeleteAssignRule = (rule: AssignmentRule) => {
		setSelectedAssignmentRule(rule);
		setDeleteAssignRuleDialogOpen(true);
	};

	const confirmDeleteAssignRule = () => {
		if (selectedAssignmentRule) {
			deleteAssignRuleMutation.mutate(selectedAssignmentRule.id);
		}
	};

	const submitAssignRuleForm = () => {
		if (!assignRuleForm.workflow_id) {
			setSnackbar({
				open: true,
				message: 'Выберите шаблон согласования',
				severity: 'error',
			});
			return;
		}

		// Подготовка данных на основе выбранного типа назначения
		const data: any = {
			workflow_id: assignRuleForm.workflow_id,
		};

		// Добавляем только нужные поля в зависимости от типа
		switch (assignRuleForm.assignment_type) {
			case 'user':
				if (!assignRuleForm.user_id) {
					setSnackbar({
						open: true,
						message: 'Выберите пользователя',
						severity: 'error',
					});
					return;
				}
				data.user_id = assignRuleForm.user_id;
				break;
			case 'role':
				if (!assignRuleForm.role_id) {
					setSnackbar({
						open: true,
						message: 'Выберите роль',
						severity: 'error',
					});
					return;
				}
				data.role_id = assignRuleForm.role_id;
				break;
			case 'file_type':
				if (!assignRuleForm.file_type_id) {
					setSnackbar({
						open: true,
						message: 'Выберите тип файла',
						severity: 'error',
					});
					return;
				}
				data.file_type_id = assignRuleForm.file_type_id;
				break;
			case 'directory':
				if (!assignRuleForm.directory_id) {
					setSnackbar({
						open: true,
						message: 'Выберите директорию',
						severity: 'error',
					});
					return;
				}
				data.directory_id = assignRuleForm.directory_id;
				break;
			case 'all':
				// Для типа 'all' дополнительные параметры не нужны
				break;
		}

		if (isEditingAssignRule) {
			updateAssignRuleMutation.mutate({
				ruleId: assignRuleForm.id,
				data,
			});
		} else {
			createAssignRuleMutation.mutate(data);
		}
	};

	// Вспомогательные функции для отображения
	const getUserName = (userId: number | null) => {
		if (!userId) return 'Нет пользователя';
		const user = users?.find((u: User) => u.id === userId);
		return user ? user.login : 'Неизвестный пользователь';
	};

	const getRoleName = (roleId: number) => {
		const role = roles?.find((r: Role) => r.id === roleId);
		return role ? role.name : 'Неизвестная роль';
	};

	const getFileTypeName = (fileTypeId: number | null) => {
		if (!fileTypeId) return 'Все типы файлов';
		const fileType = fileTypes?.find((ft: FileType) => ft.id === fileTypeId);
		return fileType
			? `${fileType.name} (${fileType.extension})`
			: 'Неизвестный тип файла';
	};

	const getWorkflowName = (workflowId: number) => {
		const workflow = workflows?.find((w: Workflow) => w.id === workflowId);
		return workflow ? workflow.name : 'Неизвестный шаблон';
	};

	const getDirectoryName = (directoryId: number | null) => {
		if (!directoryId) return 'Все директории';

		if (!directories || !directories.data) return 'Неизвестная директория';

		const directory = directories.data.find(
			(d: Directory) => d.id === directoryId
		);
		return directory ? directory.name_folder : 'Неизвестная директория';
	};

	// Функция для назначения workflow на директорию
	const handleAssignWorkflowToDirectory = (directoryId: number) => {
		if (!selectedWorkflow) return;

		assignWorkflowMutation.mutate({
			workflowId: selectedWorkflow.id,
			directoryId,
		});
	};

	// Проверка на загрузку и ошибки
	const isLoading =
		isWorkflowsLoading ||
		isUsersLoading ||
		isRolesLoading ||
		isFileTypesLoading ||
		(activeTab === 1 && isAssignmentRulesLoading) ||
		isDirectoriesLoading;

	if (isLoading) {
		return <LoadingState message='Загрузка данных...' />;
	}

	if (
		(activeTab === 0 && isWorkflowsError) ||
		(activeTab === 1 && isAssignmentRulesError)
	) {
		return (
			<ErrorState
				onRetry={activeTab === 0 ? refetchWorkflows : refetchAssignmentRules}
			/>
		);
	}

	return (
		<Box sx={{ p: 4 }}>
			<Paper
				elevation={2}
				sx={{
					borderRadius: 3,
					overflow: 'hidden',
					maxWidth: 1200,
					mx: 'auto',
					bgcolor: theme.palette.background.paper,
					boxShadow: `0 6px 20px ${alpha(theme.palette.primary.main, 0.12)}`,
				}}
			>
				{/* Заголовок */}
				<Box
					sx={{
						bgcolor: alpha(theme.palette.secondary.light, 0.1),
						py: 2.5,
						px: 4,
						borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
					}}
				>
					<Typography variant='h5' fontWeight={600} gutterBottom>
						Редактор согласования
					</Typography>
					<Typography variant='body1' color='text.secondary'>
						Управление и настройка процессов согласования документов
					</Typography>
				</Box>

				{/* Табы */}
				<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
					<Tabs
						value={activeTab}
						onChange={handleTabChange}
						aria-label='approval editor tabs'
						sx={{
							'& .MuiTab-root': {
								textTransform: 'none',
								fontSize: '0.95rem',
								fontWeight: 500,
								py: 2,
								px: 3,
							},
						}}
					>
						<Tab
							label='Конструктор шаблонов согласования'
							icon={<AccountTreeIcon />}
							iconPosition='start'
						/>
						<Tab
							label='Назначение шаблонов согласования'
							icon={<ArticleOutlinedIcon />}
							iconPosition='start'
						/>
					</Tabs>
				</Box>

				{/* Содержимое вкладок */}
				<Box sx={{ p: 4 }}>
					{/* Вкладка конструктора шаблонов */}
					{activeTab === 0 && (
						<Box>
							<Box
								sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}
							>
								<Typography variant='h6' gutterBottom>
									Конструктор шаблонов согласования
								</Typography>
								<Box sx={{ display: 'flex', gap: 1 }}>
									<Button
										variant='outlined'
										startIcon={<RefreshIcon />}
										onClick={() => refetchWorkflows()}
										sx={{ borderRadius: 2 }}
									>
										Обновить
									</Button>
									<Button
										variant='contained'
										startIcon={<AddCircleOutlineIcon />}
										onClick={handleCreateWorkflow}
										sx={{ borderRadius: 2 }}
									>
										Создать шаблон
									</Button>
								</Box>
							</Box>

							<Divider sx={{ my: 2 }} />

							<Grid container spacing={3}>
								{/* Левая колонка - список шаблонов */}
								<Grid item xs={12} md={4}>
									<Card
										sx={{
											borderRadius: 2,
											border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
											height: '100%',
										}}
									>
										<CardHeader
											title='Шаблоны согласования'
											titleTypographyProps={{
												variant: 'subtitle1',
												fontWeight: 600,
											}}
											sx={{
												borderBottom: `1px solid ${alpha(
													theme.palette.divider,
													0.1
												)}`,
											}}
										/>
										<Box
											sx={{
												maxHeight: 500,
												overflowY: 'auto',
												p: 0,
											}}
										>
										{workflows && workflows.length > 0 ? (
											<List disablePadding>
												{workflows.map((workflow: Workflow) => (
												<ListItem
													key={workflow.id}
													button
													onClick={() => handleWorkflowSelect(workflow)}
													selected={selectedWorkflow?.id === workflow.id}
													dense
													sx={{
													borderBottom: `1px solid ${alpha(theme.palette.divider, 0.05)}`,
													transition: 'all 0.2s',
													py: 1.5,
													'&.Mui-selected': {
														backgroundColor: alpha(theme.palette.primary.main, 0.08),
														'&:hover': {
														backgroundColor: alpha(theme.palette.primary.main, 0.12),
														},
													},
													}}
												>
													<ListItemIcon sx={{ minWidth: 40 }}>
													<AccountTreeIcon
														color={selectedWorkflow?.id === workflow.id ? 'primary' : 'action'}
													/>
													</ListItemIcon>
													<ListItemText
													primary={workflow.name}
													secondary={`${workflow.workflow_length} этап(а)`}
													primaryTypographyProps={{ fontWeight: 500 }}
													/>
													<ListItemSecondaryAction>
													<Tooltip title='Редактировать шаблон'>
														<IconButton
														edge='end'
														size='small'
														onClick={(e) => {
															e.stopPropagation();
															handleEditWorkflow(workflow);
														}}
														>
														<EditIcon fontSize='small' />
														</IconButton>
													</Tooltip>
													</ListItemSecondaryAction>
												</ListItem>
												))}
																						</List>
											) : (
												<Box sx={{ p: 3, textAlign: 'center' }}>
													<Typography color='text.secondary'>
														Нет созданных шаблонов
													</Typography>
												</Box>
											)}
										</Box>
									</Card>
								</Grid>

								{/* Правая колонка - детали шаблона */}
								<Grid item xs={12} md={8}>
									<Card
										sx={{
											borderRadius: 2,
											border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
											height: '100%',
										}}
									>
										{selectedWorkflow ? (
											<>
												<CardHeader
													title={
														<Box
															sx={{
																display: 'flex',
																alignItems: 'center',
																justifyContent: 'space-between',
															}}
														>
															<Typography variant='subtitle1' fontWeight={600}>
																{selectedWorkflow.name}
															</Typography>
															<Box>
																<Tooltip title='Просмотреть дерево директорий'>
																	<IconButton
																		size='small'
																		onClick={handleViewWorkflowTree}
																		sx={{ mr: 1 }}
																	>
																		<VisibilityIcon fontSize='small' />
																	</IconButton>
																</Tooltip>
																<Tooltip title='Редактировать'>
																	<IconButton
																		size='small'
																		onClick={() =>
																			handleEditWorkflow(selectedWorkflow)
																		}
																		sx={{ mr: 1 }}
																	>
																		<EditIcon fontSize='small' />
																	</IconButton>
																</Tooltip>
																<Tooltip title='Удалить'>
																	<IconButton
																		size='small'
																		color='error'
																		onClick={handleDeleteWorkflow}
																	>
																		<DeleteOutlineIcon fontSize='small' />
																	</IconButton>
																</Tooltip>
															</Box>
														</Box>
													}
													subheader={selectedWorkflow.description}
													sx={{
														borderBottom: `1px solid ${alpha(
															theme.palette.divider,
															0.1
														)}`,
													}}
												/>
												<CardContent>
													<Box sx={{ mb: 2 }}>
														<Box
															sx={{
																display: 'flex',
																justifyContent: 'space-between',
																alignItems: 'center',
																mb: 2,
															}}
														>
															<Typography variant='subtitle2' fontWeight={600}>
																Этапы согласования
															</Typography>
															<Button
																startIcon={<AddCircleOutlineIcon />}
																size='small'
																variant='outlined'
																onClick={handleAddStep}
																sx={{ borderRadius: 2 }}
															>
																Добавить этап
															</Button>
														</Box>

														{selectedWorkflow.steps &&
														selectedWorkflow.steps.length > 0 ? (
															<Box>
																{selectedWorkflow.steps
																	.sort((a, b) => a.order - b.order)
																	.map((step, index) => (
																		<Paper
																			key={step.id}
																			sx={{
																				p: 2,
																				mb: 2,
																				borderRadius: 2,
																				border: `1px solid ${alpha(
																					theme.palette.divider,
																					0.1
																				)}`,
																				backgroundColor: step.is_final
																					? alpha(
																							theme.palette.success.light,
																							0.1
																					  )
																					: 'transparent',
																			}}
																		>
																			<Box
																				sx={{
																					display: 'flex',
																					justifyContent: 'space-between',
																					alignItems: 'center',
																				}}
																			>
																				<Box
																					sx={{
																						display: 'flex',
																						alignItems: 'center',
																					}}
																				>
																					<Typography
																						variant='subtitle2'
																						sx={{
																							mr: 2,
																							minWidth: 24,
																							height: 24,
																							borderRadius: '50%',
																							backgroundColor:
																								theme.palette.primary.main,
																							color: 'white',
																							display: 'flex',
																							alignItems: 'center',
																							justifyContent: 'center',
																							fontWeight: 600,
																						}}
																					>
																						{step.order}
																					</Typography>
																					<Box>
																						<Typography
																							variant='body2'
																							fontWeight={500}
																						>
																							{step.is_final ? (
																								<Box
																									component='span'
																									sx={{
																										display: 'flex',
																										alignItems: 'center',
																									}}
																								>
																									Финальное согласование
																									<DoneIcon
																										fontSize='small'
																										color='success'
																										sx={{ ml: 0.5 }}
																									/>
																								</Box>
																							) : (
																								`Этап ${step.order}`
																							)}
																						</Typography>
																						<Box
																							sx={{
																								display: 'flex',
																								alignItems: 'center',
																								mt: 0.5,
																							}}
																						>
																							{step.user_id ? (
																								<Chip
																									icon={
																										<PersonOutlineIcon fontSize='small' />
																									}
																									label={getUserName(
																										step.user_id
																									)}
																									size='small'
																									variant='outlined'
																									sx={{ mr: 1 }}
																								/>
																							) : null}
																							<Chip
																								label={getRoleName(
																									step.role_id
																								)}
																								size='small'
																								color='primary'
																								variant='outlined'
																							/>
																						</Box>
																					</Box>
																				</Box>
																				<Box>
																					<Tooltip title='Редактировать этап'>
																						<IconButton
																							size='small'
																							onClick={() =>
																								handleEditStep(step)
																							}
																						>
																							<EditIcon fontSize='small' />
																						</IconButton>
																					</Tooltip>
																					<Tooltip title='Удалить этап'>
																						<IconButton
																							size='small'
																							color='error'
																							onClick={() =>
																								handleDeleteStep(step.id)
																							}
																						>
																							<DeleteOutlineIcon fontSize='small' />
																						</IconButton>
																					</Tooltip>
																				</Box>
																			</Box>

																			{/* Стрелка к следующему этапу, если не последний */}
																			{index <
																				selectedWorkflow.steps.length - 1 && (
																				<Box
																					sx={{
																						textAlign: 'center',
																						my: 1,
																						color: theme.palette.text.secondary,
																					}}
																				>
																					<ArrowForwardIcon
																						sx={{ transform: 'rotate(90deg)' }}
																					/>
																				</Box>
																			)}
																		</Paper>
																	))}
															</Box>
														) : (
															<Paper
																sx={{
																	p: 3,
																	borderRadius: 2,
																	textAlign: 'center',
																	border: `1px dashed ${alpha(
																		theme.palette.primary.main,
																		0.3
																	)}`,
																}}
															>
																<Typography color='text.secondary'>
																	Нет настроенных этапов согласования.
																</Typography>
																<Typography
																	color='text.secondary'
																	variant='body2'
																	sx={{ mt: 1 }}
																>
																	Добавьте хотя бы один этап для настройки
																	процесса согласования.
																</Typography>
																<Button
																	startIcon={<AddCircleOutlineIcon />}
																	variant='outlined'
																	onClick={handleAddStep}
																	sx={{ mt: 2, borderRadius: 2 }}
																>
																	Добавить первый этап
																</Button>
															</Paper>
														)}
													</Box>
												</CardContent>
											</>
										) : (
											<Box sx={{ p: 4, textAlign: 'center' }}>
												<AccountTreeIcon
													sx={{
														fontSize: 60,
														color: alpha(theme.palette.primary.main, 0.2),
														mb: 2,
													}}
												/>
												<Typography
													variant='subtitle1'
													gutterBottom
													fontWeight={500}
												>
													Выберите шаблон для просмотра
												</Typography>
												<Typography
													color='text.secondary'
													variant='body2'
													sx={{ mb: 3 }}
												>
													Выберите существующий шаблон из списка слева или
													создайте новый
												</Typography>
												<Button
													variant='contained'
													startIcon={<AddCircleOutlineIcon />}
													onClick={handleCreateWorkflow}
													sx={{ borderRadius: 2 }}
												>
													Создать шаблон
												</Button>
											</Box>
										)}
									</Card>
								</Grid>
							</Grid>
						</Box>
					)}

					{/* Вкладка назначения шаблонов */}
					{activeTab === 1 && (
						<Box>
							<Box
								sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}
							>
								<Typography variant='h6' gutterBottom>
									Назначение шаблонов согласования
								</Typography>
								<Box sx={{ display: 'flex', gap: 1 }}>
									<Button
										variant='outlined'
										startIcon={<RefreshIcon />}
										onClick={() => refetchAssignmentRules()}
										sx={{ borderRadius: 2 }}
									>
										Обновить
									</Button>
									<Button
										variant='contained'
										startIcon={<AddCircleOutlineIcon />}
										onClick={handleCreateAssignRule}
										sx={{ borderRadius: 2 }}
									>
										Создать правило
									</Button>
								</Box>
							</Box>

							<Divider sx={{ my: 2 }} />

							<Grid container spacing={2}>
								{assignmentRules && assignmentRules.length > 0 ? (
									assignmentRules.map((rule: AssignmentRule) => (
										<Grid item xs={12} md={6} lg={4} key={rule.id}>
											<Paper
												elevation={1}
												sx={{
													p: 2,
													borderRadius: 2,
													border: `1px solid ${alpha(
														theme.palette.divider,
														0.1
													)}`,
													height: '100%',
													'&:hover': {
														boxShadow: `0 4px 12px ${alpha(
															theme.palette.primary.main,
															0.1
														)}`,
													},
												}}
											>
												<Box
													sx={{
														display: 'flex',
														justifyContent: 'space-between',
														mb: 2,
													}}
												>
													<Typography variant='subtitle1' fontWeight={600}>
														{getWorkflowName(rule.workflow_id)}
													</Typography>
													<Box>
														<Tooltip title='Редактировать'>
															<IconButton
																size='small'
																onClick={() => handleEditAssignRule(rule)}
															>
																<EditIcon fontSize='small' />
															</IconButton>
														</Tooltip>
														<Tooltip title='Удалить'>
															<IconButton
																size='small'
																color='error'
																onClick={() => handleDeleteAssignRule(rule)}
															>
																<DeleteOutlineIcon fontSize='small' />
															</IconButton>
														</Tooltip>
													</Box>
												</Box>

												{/* Директория */}
												{rule.directory_id && (
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															mb: 1,
														}}
													>
														<Typography
															variant='body2'
															fontWeight={500}
															sx={{ mr: 1, minWidth: 110 }}
														>
															Директория:
														</Typography>
														<Chip
															icon={<FolderOutlinedIcon fontSize='small' />}
															label={getDirectoryName(rule.directory_id)}
															size='small'
															color='primary'
															variant='outlined'
														/>
													</Box>
												)}

												{/* Тип файла */}
												{rule.file_type_id && (
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															mb: 1,
														}}
													>
														<Typography
															variant='body2'
															fontWeight={500}
															sx={{ mr: 1, minWidth: 110 }}
														>
															Тип файла:
														</Typography>
														<Chip
															icon={
																<DescriptionOutlinedIcon fontSize='small' />
															}
															label={getFileTypeName(rule.file_type_id)}
															size='small'
															color='primary'
															variant='outlined'
														/>
													</Box>
												)}

												{/* Пользователь */}
												{rule.user_id && (
													<Box
														sx={{
															display: 'flex',
															alignItems: 'center',
															mb: 1,
														}}
													>
														<Typography
															variant='body2'
															fontWeight={500}
															sx={{ mr: 1, minWidth: 110 }}
														>
															Пользователь:
														</Typography>
														<Chip
															icon={<PersonOutlineIcon fontSize='small' />}
															label={getUserName(rule.user_id)}
															size='small'
															color='primary'
															variant='outlined'
														/>
													</Box>
												)}

												{/* Роль */}
												{rule.role_id && (
													<Box sx={{ display: 'flex', alignItems: 'center' }}>
														<Typography
															variant='body2'
															fontWeight={500}
															sx={{ mr: 1, minWidth: 110 }}
														>
															Роль:
														</Typography>
														<Chip
															label={getRoleName(rule.role_id)}
															size='small'
															color='primary'
															variant='outlined'
														/>
													</Box>
												)}

												{/* Если ни одно поле не задано */}
												{!rule.directory_id &&
													!rule.file_type_id &&
													!rule.user_id &&
													!rule.role_id && (
														<Box sx={{ display: 'flex', alignItems: 'center' }}>
															<Typography
																variant='body2'
																color='text.secondary'
															>
																Правило применяется ко всем файлам и
																пользователям
															</Typography>
														</Box>
													)}
											</Paper>
										</Grid>
									))
								) : (
									<Grid item xs={12}>
										<Paper
											sx={{
												p: 4,
												borderRadius: 2,
												textAlign: 'center',
												border: `1px dashed ${alpha(
													theme.palette.primary.main,
													0.3
												)}`,
											}}
										>
											<ArticleOutlinedIcon
												sx={{
													fontSize: 60,
													color: alpha(theme.palette.primary.main, 0.2),
													mb: 2,
												}}
											/>
											<Typography
												variant='subtitle1'
												gutterBottom
												fontWeight={500}
											>
												Нет правил назначения
											</Typography>
											<Typography
												color='text.secondary'
												variant='body2'
												sx={{ mb: 3 }}
											>
												Создайте правила для автоматического назначения шаблонов
												согласования файлам
											</Typography>
											<Button
												variant='contained'
												startIcon={<AddCircleOutlineIcon />}
												onClick={handleCreateAssignRule}
												sx={{ borderRadius: 2 }}
											>
												Создать правило
											</Button>
										</Paper>
									</Grid>
								)}
							</Grid>
						</Box>
					)}
				</Box>
			</Paper>

			{/* Диалог создания/редактирования шаблона */}
			<Dialog
				open={workflowDialogOpen}
				onClose={() => setWorkflowDialogOpen(false)}
				maxWidth='sm'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<DriveFileRenameOutlineIcon color='primary' />
							<Typography variant='h6' fontWeight={600}>
								{isEditingWorkflow
									? 'Редактирование шаблона'
									: 'Создание шаблона согласования'}
							</Typography>
						</Box>
						<IconButton onClick={() => setWorkflowDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Grid container spacing={2}>
						<Grid item xs={12}>
							<TextField
								fullWidth
								label='Название шаблона'
								value={workflowForm.name}
								onChange={e =>
									setWorkflowForm({ ...workflowForm, name: e.target.value })
								}
								variant='outlined'
								required
							/>
						</Grid>
						<Grid item xs={12}>
							<TextField
								fullWidth
								label='Описание'
								value={workflowForm.description}
								onChange={e =>
									setWorkflowForm({
										...workflowForm,
										description: e.target.value,
									})
								}
								variant='outlined'
								multiline
								rows={3}
							/>
						</Grid>
					</Grid>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setWorkflowDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={submitWorkflowForm}
						variant='contained'
						disabled={
							!workflowForm.name ||
							createWorkflowMutation.isPending ||
							updateWorkflowMutation.isPending
						}
						startIcon={
							createWorkflowMutation.isPending ||
							updateWorkflowMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : (
								<SaveIcon />
							)
						}
						sx={{ borderRadius: 2 }}
					>
						{isEditingWorkflow ? 'Сохранить' : 'Создать'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог создания/редактирования этапа */}
			<Dialog
				open={stepDialogOpen}
				onClose={() => setStepDialogOpen(false)}
				maxWidth='sm'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<AccountTreeIcon color='primary' />
							<Typography variant='h6' fontWeight={600}>
								{isEditingStep
									? 'Редактирование этапа'
									: 'Добавление этапа согласования'}
							</Typography>
						</Box>
						<IconButton onClick={() => setStepDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Grid container spacing={2}>
						<Grid item xs={12} sm={6}>
							<TextField
								fullWidth
								label='Порядковый номер'
								type='number'
								value={stepForm.order}
								onChange={e =>
									setStepForm({ ...stepForm, order: parseInt(e.target.value) })
								}
								variant='outlined'
								inputProps={{ min: 1 }}
								required
							/>
						</Grid>
						<Grid item xs={12} sm={6}>
							<FormControl component='fieldset' sx={{ mt: 1 }}>
								<FormControlLabel
									control={
										<Radio
											checked={stepForm.is_final}
											onChange={e =>
												setStepForm({ ...stepForm, is_final: e.target.checked })
											}
										/>
									}
									label='Финальный этап согласования'
								/>
							</FormControl>
						</Grid>
						<Grid item xs={12}>
							<FormControl fullWidth variant='outlined' required>
								<InputLabel>Роль согласующего</InputLabel>
								<Select
									value={stepForm.role_id || ''}
									onChange={e =>
										setStepForm({
											...stepForm,
											role_id: Number(e.target.value),
										})
									}
									label='Роль согласующего'
								>
									<MenuItem value=''>
										<em>Выберите роль</em>
									</MenuItem>
									{roles &&
										roles.map((role: Role) => (
											<MenuItem key={role.id} value={role.id}>
												{role.name}
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12}>
							<FormControl fullWidth variant='outlined'>
								<InputLabel>Конкретный пользователь (необязательно)</InputLabel>
								<Select
									value={stepForm.user_id !== null ? stepForm.user_id : ''}
									onChange={e =>
										setStepForm({
											...stepForm,
											user_id:
												e.target.value === '' ? null : Number(e.target.value),
										})
									}
									label='Конкретный пользователь (необязательно)'
								>
									<MenuItem value=''>
										<em>Любой пользователь с указанной ролью</em>
									</MenuItem>
									{users &&
										users.map((user: User) => (
											<MenuItem key={user.id} value={user.id}>
												{user.login} ({user.role_name})
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</Grid>
					</Grid>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setStepDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={submitStepForm}
						variant='contained'
						disabled={
							!stepForm.role_id ||
							stepForm.order < 1 ||
							createStepMutation.isPending ||
							updateStepMutation.isPending
						}
						startIcon={
							createStepMutation.isPending || updateStepMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : (
								<SaveIcon />
							)
						}
						sx={{ borderRadius: 2 }}
					>
						{isEditingStep ? 'Сохранить' : 'Добавить'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог подтверждения удаления шаблона */}
			<Dialog
				open={deleteWorkflowDialogOpen}
				onClose={() => setDeleteWorkflowDialogOpen(false)}
				maxWidth='xs'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<DeleteOutlineIcon color='error' />
							<Typography variant='h6' fontWeight={600}>
								Удаление шаблона
							</Typography>
						</Box>
						<IconButton onClick={() => setDeleteWorkflowDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Typography variant='body1'>
						Вы действительно хотите удалить шаблон{' '}
						<strong>{selectedWorkflow?.name}</strong>?
					</Typography>
					<Typography variant='body2' color='error' sx={{ mt: 1 }}>
						Внимание! Все настроенные этапы согласования и правила назначения
						будут удалены.
					</Typography>
					<Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
						Это действие невозможно отменить.
					</Typography>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setDeleteWorkflowDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={confirmDeleteWorkflow}
						variant='contained'
						color='error'
						disabled={deleteWorkflowMutation.isPending}
						startIcon={
							deleteWorkflowMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						Удалить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог подтверждения удаления этапа */}
			<Dialog
				open={deleteStepDialogOpen}
				onClose={() => setDeleteStepDialogOpen(false)}
				maxWidth='xs'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<DeleteOutlineIcon color='error' />
							<Typography variant='h6' fontWeight={600}>
								Удаление этапа
							</Typography>
						</Box>
						<IconButton onClick={() => setDeleteStepDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Typography variant='body1'>
						Вы действительно хотите удалить этот этап согласования?
					</Typography>
					<Typography variant='body2' color='error' sx={{ mt: 1 }}>
						Внимание! Это может нарушить последовательность этапов согласования.
					</Typography>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setDeleteStepDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={confirmDeleteStep}
						variant='contained'
						color='error'
						disabled={deleteStepMutation.isPending}
						startIcon={
							deleteStepMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						Удалить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог создания/редактирования правила назначения */}
			<Dialog
				open={assignRuleDialogOpen}
				onClose={() => setAssignRuleDialogOpen(false)}
				maxWidth='sm'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<ArticleOutlinedIcon color='primary' />
							<Typography variant='h6' fontWeight={600}>
								{isEditingAssignRule
									? 'Редактирование правила'
									: 'Создание правила назначения'}
							</Typography>
						</Box>
						<IconButton onClick={() => setAssignRuleDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Grid container spacing={2}>
						<Grid item xs={12}>
							<FormControl fullWidth variant='outlined' required>
								<InputLabel>Шаблон согласования</InputLabel>
								<Select
									value={assignRuleForm.workflow_id || ''}
									onChange={e =>
										setAssignRuleForm({
											...assignRuleForm,
											workflow_id: Number(e.target.value),
										})
									}
									label='Шаблон согласования'
								>
									<MenuItem value=''>
										<em>Выберите шаблон</em>
									</MenuItem>
									{workflows &&
										workflows.map((workflow: Workflow) => (
											<MenuItem key={workflow.id} value={workflow.id}>
												{workflow.name} ({workflow.steps?.length || 0} этапов)
											</MenuItem>
										))}
								</Select>
							</FormControl>
						</Grid>
						<Grid item xs={12}>
							<Typography variant='subtitle2' gutterBottom>
								Применять правило к:
							</Typography>
							<RadioGroup
								value={assignRuleForm.assignment_type}
								onChange={e =>
									setAssignRuleForm({
										...assignRuleForm,
										assignment_type: e.target.value as
											| 'all'
											| 'user'
											| 'role'
											| 'file_type'
											| 'directory',
										// Сбрасываем все поля при смене типа правила
										user_id: null,
										role_id: null,
										file_type_id: null,
										directory_id: null,
									})
								}
							>
								<FormControlLabel
									value='all'
									control={<Radio />}
									label='Всем'
								/>
								<FormControlLabel
									value='user'
									control={<Radio />}
									label='Конкретному пользователю'
								/>
								<FormControlLabel
									value='role'
									control={<Radio />}
									label='Определенной роли'
								/>
								<FormControlLabel
									value='file_type'
									control={<Radio />}
									label='Определенному типу файлов'
								/>
								<FormControlLabel
									value='directory'
									control={<Radio />}
									label='Конкретной директории'
								/>
							</RadioGroup>
						</Grid>

						{/* Дополнительные поля в зависимости от выбранного типа */}
						{assignRuleForm.assignment_type === 'user' && (
							<Grid item xs={12}>
								<FormControl fullWidth variant='outlined' required>
									<InputLabel>Пользователь</InputLabel>
									<Select
										value={assignRuleForm.user_id || ''}
										onChange={e =>
											setAssignRuleForm({
												...assignRuleForm,
												user_id:
													e.target.value === '' ? null : Number(e.target.value),
											})
										}
										label='Пользователь'
									>
										<MenuItem value=''>
											<em>Выберите пользователя</em>
										</MenuItem>
										{users &&
											users.map((user: User) => (
												<MenuItem key={user.id} value={user.id}>
													{user.login} ({user.role_name || 'Нет роли'})
												</MenuItem>
											))}
									</Select>
								</FormControl>
							</Grid>
						)}

						{assignRuleForm.assignment_type === 'role' && (
							<Grid item xs={12}>
								<FormControl fullWidth variant='outlined' required>
									<InputLabel>Роль</InputLabel>
									<Select
										value={assignRuleForm.role_id || ''}
										onChange={e =>
											setAssignRuleForm({
												...assignRuleForm,
												role_id:
													e.target.value === '' ? null : Number(e.target.value),
											})
										}
										label='Роль'
									>
										<MenuItem value=''>
											<em>Выберите роль</em>
										</MenuItem>
										{roles &&
											roles.map((role: Role) => (
												<MenuItem key={role.id} value={role.id}>
													{role.name}
												</MenuItem>
											))}
									</Select>
								</FormControl>
							</Grid>
						)}

						{assignRuleForm.assignment_type === 'file_type' && (
							<Grid item xs={12}>
								<FormControl fullWidth variant='outlined' required>
									<InputLabel>Тип файла</InputLabel>
									<Select
										value={assignRuleForm.file_type_id || ''}
										onChange={e =>
											setAssignRuleForm({
												...assignRuleForm,
												file_type_id:
													e.target.value === '' ? null : Number(e.target.value),
											})
										}
										label='Тип файла'
									>
										<MenuItem value=''>
											<em>Выберите тип файла</em>
										</MenuItem>
										{fileTypes &&
											fileTypes.map((fileType: FileType) => (
												<MenuItem key={fileType.id} value={fileType.id}>
													{fileType.name} (.{fileType.extension})
												</MenuItem>
											))}
									</Select>
								</FormControl>
							</Grid>
						)}

						{assignRuleForm.assignment_type === 'directory' && (
							<Grid item xs={12}>
								<FormControl fullWidth variant='outlined' required>
									<InputLabel>Директория</InputLabel>
									<Select
										value={assignRuleForm.directory_id || ''}
										onChange={e =>
											setAssignRuleForm({
												...assignRuleForm,
												directory_id:
													e.target.value === '' ? null : Number(e.target.value),
											})
										}
										label='Директория'
									>
										<MenuItem value=''>
											<em>Выберите директорию</em>
										</MenuItem>
										{directories &&
											directories.data &&
											directories.data.map((dir: Directory) => (
												<MenuItem key={dir.id} value={dir.id}>
													{dir.name_folder}
												</MenuItem>
											))}
									</Select>
								</FormControl>
							</Grid>
						)}
					</Grid>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setAssignRuleDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={submitAssignRuleForm}
						variant='contained'
						disabled={
							!assignRuleForm.workflow_id ||
							createAssignRuleMutation.isPending ||
							updateAssignRuleMutation.isPending ||
							(assignRuleForm.assignment_type === 'user' &&
								!assignRuleForm.user_id) ||
							(assignRuleForm.assignment_type === 'role' &&
								!assignRuleForm.role_id) ||
							(assignRuleForm.assignment_type === 'file_type' &&
								!assignRuleForm.file_type_id) ||
							(assignRuleForm.assignment_type === 'directory' &&
								!assignRuleForm.directory_id)
						}
						startIcon={
							createAssignRuleMutation.isPending ||
							updateAssignRuleMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : (
								<SaveIcon />
							)
						}
						sx={{ borderRadius: 2 }}
					>
						{isEditingAssignRule ? 'Сохранить' : 'Создать'}
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог подтверждения удаления правила назначения */}
			<Dialog
				open={deleteAssignRuleDialogOpen}
				onClose={() => setDeleteAssignRuleDialogOpen(false)}
				maxWidth='xs'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<DeleteOutlineIcon color='error' />
							<Typography variant='h6' fontWeight={600}>
								Удаление правила
							</Typography>
						</Box>
						<IconButton onClick={() => setDeleteAssignRuleDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3 }}>
					<Typography variant='body1'>
						Вы действительно хотите удалить это правило назначения?
					</Typography>
					<Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
						Это действие невозможно отменить.
					</Typography>
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setDeleteAssignRuleDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Отмена
					</Button>
					<Button
						onClick={confirmDeleteAssignRule}
						variant='contained'
						color='error'
						disabled={deleteAssignRuleMutation.isPending}
						startIcon={
							deleteAssignRuleMutation.isPending ? (
								<CircularProgress size={16} color='inherit' />
							) : null
						}
						sx={{ borderRadius: 2 }}
					>
						Удалить
					</Button>
				</DialogActions>
			</Dialog>

			{/* Диалог просмотра дерева директорий workflow */}
			<Dialog
				open={viewWorkflowTreeDialogOpen}
				onClose={() => setViewWorkflowTreeDialogOpen(false)}
				maxWidth='md'
				fullWidth
				PaperProps={{
					sx: {
						borderRadius: 3,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
					},
				}}
			>
				<DialogTitle sx={{ pb: 2 }}>
					<Box
						display='flex'
						justifyContent='space-between'
						alignItems='center'
					>
						<Box display='flex' alignItems='center' gap={1}>
							<FolderOutlinedIcon color='primary' />
							<Typography variant='h6' fontWeight={600}>
								Дерево директорий шаблона {selectedWorkflow?.name}
							</Typography>
						</Box>
						<IconButton onClick={() => setViewWorkflowTreeDialogOpen(false)}>
							<CloseIcon />
						</IconButton>
					</Box>
				</DialogTitle>
				<Divider />
				<DialogContent sx={{ pt: 3, minHeight: 400 }}>
					{isWorkflowTreeLoading ? (
						<Box
							sx={{
								display: 'flex',
								justifyContent: 'center',
								alignItems: 'center',
								height: 300,
							}}
						>
							<CircularProgress />
						</Box>
					) : workflowTree &&
					  workflowTree.directories &&
					  workflowTree.directories.length > 0 ? (
						<List>
							{workflowTree.directories.map((dir: any) => (
								<ListItem
									key={dir.id}
									sx={{
										borderBottom: `1px solid ${alpha(
											theme.palette.divider,
											0.1
										)}`,
										py: 1,
									}}
								>
									<ListItemIcon>
										<FolderOutlinedIcon color='primary' />
									</ListItemIcon>
									<ListItemText
										primary={dir.name_folder}
										secondary={`ID: ${dir.id}`}
									/>
									<Button
										variant='outlined'
										size='small'
										onClick={() => handleAssignWorkflowToDirectory(dir.id)}
										sx={{ ml: 2, borderRadius: 2 }}
									>
										Назначить шаблон
									</Button>
								</ListItem>
							))}
						</List>
					) : (
						<Box sx={{ textAlign: 'center', py: 4 }}>
							<FolderOutlinedIcon
								sx={{
									fontSize: 60,
									color: alpha(theme.palette.text.secondary, 0.2),
									mb: 2,
								}}
							/>
							<Typography color='text.secondary'>
								Для этого шаблона согласования не найдено связанных директорий
							</Typography>
						</Box>
					)}
				</DialogContent>
				<Divider />
				<DialogActions sx={{ p: 2 }}>
					<Button
						onClick={() => setViewWorkflowTreeDialogOpen(false)}
						variant='outlined'
						sx={{ borderRadius: 2 }}
					>
						Закрыть
					</Button>
				</DialogActions>
			</Dialog>

			{/* Уведомления */}
			<Snackbar
				open={snackbar.open}
				autoHideDuration={4000}
				onClose={() => setSnackbar({ ...snackbar, open: false })}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
			>
				<Alert
					onClose={() => setSnackbar({ ...snackbar, open: false })}
					severity={snackbar.severity}
					variant='filled'
					sx={{ width: '100%', borderRadius: 2 }}
				>
					{snackbar.message}
				</Alert>
			</Snackbar>
		</Box>
	);
};

export default ApprovalEditorPage;
