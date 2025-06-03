import { CheckCircleOutline } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import CommentOutlinedIcon from '@mui/icons-material/CommentOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import HourglassTopOutlinedIcon from '@mui/icons-material/HourglassTopOutlined';
import {
	Alert,
	alpha,
	Box,
	Button,
	Chip,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	IconButton,
	Paper,
	Snackbar,
	TextField,
	Tooltip,
	Typography,
	useTheme,
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import {axiosFetching} from '../api/AxiosFetch';
import { updateApprovalsCount } from '../api/NavigationService';
import config from '../constants/Configurations.json';
import { ApprovalResponse } from '../interfaces/Approvals';
import { setPendingCount } from '../store/Slices/pendingApprovalsSlice';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';

// Config endpoints
const getApprovals = config.getApprovals;
const approveDocument = config.approveDocument;
const annotateDocument = config.annotateDocument;
const finalizeDocument = config.finalizeDocument;

/**
 * Main component for displaying and managing document approvals
 * This page allows users to view, approve, finalize, and annotate documents
 * in the approval workflow
 */
export const ApprovalsPage = () => {
	// State management
	const [snackbarOpen, setSnackbarOpen] = useState(false);
	const [snackbarMessage, setSnackbarMessage] = useState('');
	const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>(
		'success'
	);
	const [isAnnotationModalOpen, setIsAnnotationModalOpen] = useState(false);
	const [annotationMessage, setAnnotationMessage] = useState('');
	const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
	const [selectedFileName, setSelectedFileName] = useState<string>('');

	const dispatch = useDispatch();
	const theme = useTheme();
	const isAdmin = true; // This should be determined by user role in a real app

	// Fetch approvals data
	const {
		data: apiResponse,
		isLoading,
		isError,
		refetch,
	} = useQuery({
		queryKey: ['approvals'],
		queryFn: async () => {
			const response = await axiosFetching.get(getApprovals);
			return response.data;
		},
	});

	// Update pending count in global state
	useEffect(() => {
		if (apiResponse) {
			const pendingCount = apiResponse.length;
			dispatch(setPendingCount(pendingCount));

			// Also update global count via event
			updateApprovalsCount();
		}
	}, [apiResponse, dispatch]);

	// Mutations for document actions
	const approveDocumentMutation = useMutation({
		mutationFn: async (approvalId: number) => {
			const url = approveDocument.replace(':approval_id', String(approvalId));
			const response = await axiosFetching.put(url);
			return response.data;
		},
		onSuccess: () => {
			setSnackbarMessage('Документ был успешно согласован!');
			setSnackbarSeverity('success');
			setSnackbarOpen(true);
			refetch();

			// Update global approval count
			updateApprovalsCount();
		},
		onError: () => {
			setSnackbarMessage('Ошибка при согласовании документа.');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		},
	});

	const annotateDocumentMutation = useMutation({
		mutationFn: async ({
			approvalId,
			message,
		}: {
			approvalId: number;
			message: string;
		}) => {
			const url = annotateDocument.replace(':approval_id', String(approvalId));
			const response = await axiosFetching.put(url, { message });
			return response.data;
		},
		onSuccess: () => {
			setSnackbarMessage('Документ был успешно отправлен на доработку!');
			setSnackbarSeverity('success');
			setSnackbarOpen(true);
			refetch();
			setIsAnnotationModalOpen(false);
			setAnnotationMessage('');

			// Update global approval count
			updateApprovalsCount();
		},
		onError: () => {
			setSnackbarMessage('Ошибка при отправке документа на доработку.');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		},
	});

	const finalizeDocumentMutation = useMutation({
		mutationFn: async (approvalId: number) => {
			const url = finalizeDocument.replace(':approval_id', String(approvalId));
			const response = await axiosFetching.put(url);
			return response.data;
		},
		onSuccess: () => {
			setSnackbarMessage('Документ был успешно финализирован!');
			setSnackbarSeverity('success');
			setSnackbarOpen(true);
			refetch();

			// Update global approval count
			updateApprovalsCount();
		},
		onError: () => {
			setSnackbarMessage('Ошибка при финализации документа.');
			setSnackbarSeverity('error');
			setSnackbarOpen(true);
		},
	});

	// Handle approve or finalize action
	const handleApproveOrFinalize = (document: ApprovalResponse) => {
		if (document.workflow_order === document.workflow_user_count) {
			finalizeDocumentMutation.mutate(document.approval_id);
		} else {
			approveDocumentMutation.mutate(document.approval_id);
		}
	};

	// Handle annotate dialog
	const handleAnnotateClick = (fileId: number, fileName: string) => {
		setSelectedFileId(fileId);
		setSelectedFileName(fileName);
		setIsAnnotationModalOpen(true);
	};

	const handleAnnotationSubmit = () => {
		if (selectedFileId && annotationMessage.trim()) {
			annotateDocumentMutation.mutate({
				approvalId: selectedFileId,
				message: annotationMessage,
			});
		}
	};

	// Loading and error states
	if (isLoading) {
		return <LoadingState message='Загрузка документов на согласование...' />;
	}

	if (isError) {
		return <ErrorState onRetry={refetch} />;
	}

	// Render empty state if no documents
	if (!apiResponse || !Array.isArray(apiResponse) || apiResponse.length === 0) {
		return (
			<Box sx={{ p: 4 }}>
				<Paper
					elevation={3}
					sx={{
						borderRadius: 4,
						overflow: 'hidden',
						maxWidth: 1200,
						mx: 'auto',
						bgcolor: theme.palette.background.paper,
						boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.15)}`,
						transition: 'box-shadow 0.3s ease',
						'&:hover': {
							boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.2)}`,
						},
					}}
				>
					{/* Заголовок секции */}
					<Box
						sx={{
							bgcolor: alpha(theme.palette.secondary.light, 0.05),
							py: 3,
							px: 4,
							borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
						}}
					>
						<Typography variant='h5' fontWeight={700} gutterBottom>
							Система согласования документов
						</Typography>
						<Typography variant='body1' color='text.secondary'>
							Все документы, требующие согласования, будут отображаться здесь
						</Typography>
					</Box>
		
					{/* Состояние "Нет документов" */}
					<Box
						sx={{
							p: 6,
							textAlign: 'center',
							backgroundColor: alpha(theme.palette.background.default, 0.6),
						}}
					>
						<Box
							sx={{
								display: 'inline-flex',
								alignItems: 'center',
								justifyContent: 'center',
								width: 100,
								height: 100,
								borderRadius: '50%',
								bgcolor: alpha(theme.palette.primary.light, 0.1),
								color: theme.palette.primary.main,
								mb: 3,
								transition: 'transform 0.3s ease',
								'&:hover': {
									transform: 'rotate(10deg)',
								},
							}}
						>
							<HourglassTopOutlinedIcon sx={{ fontSize: 60 }} />
						</Box>
		
						<Typography
							variant='h6'
							fontWeight={700}
							gutterBottom
							sx={{
								color: theme.palette.text.primary,
							}}
						>
							Нет документов на согласовании
						</Typography>
		
						<Typography variant='body1' color='text.secondary' sx={{ maxWidth: 500, mx: 'auto' }}>
							В данный момент у вас нет активных документов, требующих согласования.
						</Typography>			
					</Box>
				</Paper>
			</Box>
		);
	}

	// Determine approval status chip color and label
	const getStatusChip = (
		status: string,
		workflowOrder: number,
		workflowUserCount: number
	) => {
		let color:
			| 'default'
			| 'primary'
			| 'secondary'
			| 'error'
			| 'info'
			| 'success'
			| 'warning' = 'default';
		let icon: React.ReactElement | undefined = undefined; // Use undefined instead of null
		let label = status;

		switch (status) {
			case 'on approval':
				color = workflowOrder === workflowUserCount ? 'info' : 'warning';
				icon = <HourglassTopOutlinedIcon fontSize='small' />;
				label =
					workflowOrder === workflowUserCount
						? 'Финальное согласование'
						: 'На согласовании';
				break;
			case 'approved':
				color = 'success';
				icon = <CheckCircleOutline fontSize='small' />;
				label = 'Согласовано';
				break;
			case 'annotated':
				color = 'error';
				icon = <CommentOutlinedIcon fontSize='small' />;
				label = 'На доработке';
				break;
			default:
				color = 'default';
			// icon remains undefined for default case
		}

		return (
			<Chip
				icon={icon}
				label={label}
				color={color}
				size='small'
				variant='outlined'
				sx={{ fontWeight: 500 }}
			/>
		);
	};

	// Main component render
	return (
		<Box sx={{ p: 4 }}>
			<Paper
				elevation={4}
				sx={{
					borderRadius: 4,
					overflow: 'hidden',
					maxWidth: 1200,
					mx: 'auto',
					bgcolor: theme.palette.background.paper,
					boxShadow: `0 10px 40px ${alpha(theme.palette.primary.main, 0.18)}`,
				}}
			>
				{/* Заголовок */}
				<Box
					sx={{
						bgcolor: alpha(theme.palette.primary.light, 0.08),
						py: 3,
						px: 4,
						borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
					}}
				>
					<Typography variant='h5' fontWeight={700} gutterBottom>
						Система согласования документов
					</Typography>
				</Box>
	
				{/* Список документов */}
				<Box sx={{ p: 4 }}>
					{apiResponse.map((document: ApprovalResponse) => (
						<Paper
							key={document.approval_id}
							elevation={1}
							sx={{
								mb: 3,
								borderRadius: 3,
								overflow: 'hidden',
								border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
								transition: 'all 0.2s ease-in-out',
								'&:hover': {
									boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.15)}`,
									borderColor: alpha(theme.palette.primary.main, 0.3),
								},
							}}
						>
							{/* Верхняя часть документа */}
							<Box
								sx={{
									display: 'flex',
									justifyContent: 'space-between',
									alignItems: 'center',
									px: 3,
									py: 2.5,
									borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
									backgroundColor: alpha(theme.palette.primary.light, 0.02),
								}}
							>
								<Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
									<DescriptionOutlined color='primary' sx={{ opacity: 0.9 }} />
									<Typography variant='subtitle1' fontWeight={600}>
										{document.file_name}
									</Typography>
								</Box>
								{getStatusChip(
									document.status,
									document.workflow_order,
									document.workflow_user_count
								)}
							</Box>
	
							{/* Информация и действия */}
							<Box
								sx={{
									display: 'flex',
									flexDirection: { xs: 'column', sm: 'row' },
									justifyContent: 'space-between',
									alignItems: { xs: 'flex-start', sm: 'center' },
									gap: 2,
									px: 3,
									py: 2,
								}}
							>
								<Box>
									<Typography variant='body2' color='text.secondary'>
										Этап согласования:{' '}
										<strong>{document.workflow_order}</strong> из{' '}
										<strong>{document.workflow_user_count}</strong>
									</Typography>
								</Box>
	
								{isAdmin && (
									<Box display='flex' gap={1.5} flexWrap='wrap'>
										{/* Кнопка согласовать / финализировать */}
										<Tooltip
											title={
												document.workflow_order === document.workflow_user_count
													? 'Финализировать'
													: 'Согласовать'
											}
										>
											<Button
												variant='contained'
												color={
													document.workflow_order === document.workflow_user_count
														? 'info'
														: 'success'
												}
												size='small'
												startIcon={<CheckCircleOutline />}
												onClick={() => handleApproveOrFinalize(document)}
												sx={{
													borderRadius: 2.5,
													textTransform: 'none',
													fontWeight: 600,
													boxShadow: 'none',
													'&:hover': {
														boxShadow: `0 4px 12px ${alpha(
															theme.palette.primary.main,
															0.2
														)}`,
													},
													minWidth: 110,
												}}
											>
												{document.workflow_order === document.workflow_user_count
													? 'Финализировать'
													: 'Согласовать'}
											</Button>
										</Tooltip>
	
										{/* Кнопка на доработку */}
										<Tooltip title='Отправить на доработку'>
											<Button
												variant='outlined'
												color='error'
												size='small'
												startIcon={<CommentOutlinedIcon />}
												onClick={() =>
													handleAnnotateClick(
														document.approval_id,
														document.file_name
													)
												}
												sx={{
													borderRadius: 2.5,
													textTransform: 'none',
													fontWeight: 600,
													borderColor: alpha(theme.palette.error.main, 0.4),
													color: theme.palette.error.main,
													'&:hover': {
														backgroundColor: alpha(
															theme.palette.error.main,
															0.08
														),
														borderColor: theme.palette.error.main,
													},
													minWidth: 110,
												}}
											>
												На доработку
											</Button>
										</Tooltip>
									</Box>
								)}
							</Box>
						</Paper>
					))}
				</Box>
			</Paper>
	
			{/* Уведомления */}
			<Snackbar
				open={snackbarOpen}
				autoHideDuration={4000}
				onClose={() => setSnackbarOpen(false)}
				anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
			>
				<Alert
					onClose={() => setSnackbarOpen(false)}
					severity={snackbarSeverity}
					variant='filled'
					sx={{
						width: '100%',
						borderRadius: 2.5,
						fontWeight: 500,
					}}
				>
					{snackbarMessage}
				</Alert>
			</Snackbar>
	
			{/* Диалог отправки на доработку */}
			<Dialog
				open={isAnnotationModalOpen}
				onClose={() => setIsAnnotationModalOpen(false)}
				fullWidth
				maxWidth='sm'
				PaperProps={{
				sx: {
					borderRadius: 4,
					boxShadow: `0 16px 50px ${alpha(theme.palette.primary.main, 0.25)}`,
					p: 3,
					backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#ffffff',
				},
			}}
			>
				<DialogTitle
					sx={{
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'space-between',
						borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
						py: 2.5,
						px: 3,
					}}
				>
					<Box display='flex' alignItems='center' gap={1}>
						<CommentOutlinedIcon color='error' />
						<Typography variant='h6' fontWeight={700}>
							Отправка документа на доработку
						</Typography>
					</Box>
					<IconButton
						onClick={() => setIsAnnotationModalOpen(false)}
						sx={{ color: theme.palette.text.secondary }}
					>
						<CloseIcon />
					</IconButton>
				</DialogTitle>

				<DialogContent sx={{ pt: 3, pb: 2 }}>
					<Typography variant='subtitle2' gutterBottom fontWeight={600}>
						Документ: <strong>{selectedFileName}</strong>
					</Typography>
					<Divider sx={{ my: 2 }} />

					<Typography variant='body2' color='text.secondary' paragraph>
						Укажите причину возврата документа на доработку. Ваш комментарий будет отправлен ответственному сотруднику.
					</Typography>

					<TextField
						autoFocus
						margin='dense'
						label='Комментарий'
						fullWidth
						multiline
						rows={4}
						value={annotationMessage}
						onChange={(e) => setAnnotationMessage(e.target.value)}
						variant='outlined'
						placeholder='Опишите необходимые изменения...'
						sx={{
							'& .MuiOutlinedInput-root': {
								borderRadius: 3,
								backgroundColor:
									theme.palette.mode === 'dark' ? alpha('#fff', 0.05) : alpha('#000', 0.05),
							},
							'& .MuiInputLabel-root': {
								color: theme.palette.text.secondary,
							},
						}}
					/>
				</DialogContent>

				<DialogActions
					sx={{
						px: 3,
						py: 2,
						borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
					}}
				>
					<Button
						onClick={() => setIsAnnotationModalOpen(false)}
						variant='outlined'
						color='inherit'
						sx={{
							borderRadius: 3,
							textTransform: 'none',
							fontWeight: 600,
							px: 3,
							color: theme.palette.text.secondary,
							borderColor: alpha(theme.palette.text.secondary, 0.3),
							'&:hover': {
								borderColor: theme.palette.text.secondary,
							},
						}}
					>
						Отмена
					</Button>
					<Button
						onClick={handleAnnotationSubmit}
						disabled={!annotationMessage.trim()}
						variant='contained'
						color='error'
						sx={{
							borderRadius: 3,
							textTransform: 'none',
							fontWeight: 600,
							px: 3,
							boxShadow: `0 4px 12px ${alpha(theme.palette.error.main, 0.25)}`,
							'&:hover': {
								boxShadow: `0 6px 16px ${alpha(theme.palette.error.dark, 0.35)}`,
								transform: 'translateY(-1px)',
							},
						}}
					>
						Отправить на доработку
					</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
};

export default ApprovalsPage;
