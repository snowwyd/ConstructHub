import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import BuildCircleIcon from '@mui/icons-material/BuildCircle';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import {
	alpha,
	AppBar,
	Avatar,
	Badge,
	Box,
	Button,
	Divider,
	IconButton,
	Menu,
	MenuItem,
	Toolbar,
	Typography,
	useTheme,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {axiosFetching} from '../api/AxiosFetch';
import { redirectToLogin } from '../api/NavigationService';
import config from '../constants/Configurations.json';
import { ApprovalResponse } from '../interfaces/Approvals';
import React from 'react';

// Interface for UserInfo
interface UserInfo {
	id: number;
	login: string;
	role: string;
	avatar?: string;
}

const Header = () => {
	const theme = useTheme();
	const location = useLocation();
	const navigate = useNavigate();
	const isLoginPage = location.pathname === '/';
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
	const [mobileMenuAnchor, setMobileMenuAnchor] = useState<null | HTMLElement>(
		null
	);
	const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(
		null
	);
	const [pendingApprovals, setPendingApprovals] = useState(0);

	const mobileMenuOpen = Boolean(mobileMenuAnchor);
	const userMenuOpen = Boolean(userMenuAnchor);

	// Check if user is admin
	const isAdmin = userInfo?.role === 'admin';

	// Check auth status and load user data
	useEffect(() => {
		const checkAuthStatus = async () => {
			if (isLoginPage) {
				setIsLoggedIn(false);
				return;
			}

			try {
				const response = await axiosFetching.get(config.checkJWT);
				if (response.data && response.data.id) {
					setIsLoggedIn(true);
					setUserInfo(response.data);

					// Fetch pending approvals if user is logged in
					fetchPendingApprovals();
				} else {
					setIsLoggedIn(false);
				}
			} catch (error) {
				console.error('Auth check error:', error);
				setIsLoggedIn(false);
			}
		};

		checkAuthStatus();
	}, [location.pathname, isLoginPage]);

	/**
	 * Fetches pending approvals that require user attention
	 * Updates the global state with pending approvals count
	 */
	const fetchPendingApprovals = async () => {
		try {
			console.log('Fetching pending approvals');
			const response = await axiosFetching.get(config.getApprovals);

			// Make sure we have valid response data
			if (response.data && Array.isArray(response.data)) {
				// Use the proper type instead of 'any'
				const pendingCount = response.data.filter(
					(approval: ApprovalResponse) => approval.status === 'on approval'
				).length;

				console.log(`Found ${pendingCount} pending approvals`);
				setPendingApprovals(pendingCount);
			} else {
				console.warn('Unexpected response format:', response.data);
				setPendingApprovals(0);
			}
		} catch (error) {
			console.error('Error fetching approvals:', error);
			// Default to 0 in case of error
			setPendingApprovals(0);
		}
	};

	// Add event listener for global approval count updates
	useEffect(() => {
		// Define the event handler
		const handleUpdateApprovalCount = () => {
			console.log('Approval count update requested');
			fetchPendingApprovals();
		};

		// Add event listener
		window.addEventListener('update-approval-count', handleUpdateApprovalCount);

		// Clean up
		return () => {
			window.removeEventListener(
				'update-approval-count',
				handleUpdateApprovalCount
			);
		};
	}, []);

	// Menu handlers
	const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
		setMobileMenuAnchor(event.currentTarget);
	};

	const handleMobileMenuClose = () => {
		setMobileMenuAnchor(null);
	};

	const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
		setUserMenuAnchor(event.currentTarget);
	};

	const handleUserMenuClose = () => {
		setUserMenuAnchor(null);
	};

	// Logout handler - client-side approach
	const handleLogout = () => {
		try {
			// Clear cookies
			document.cookie.split(';').forEach(c => {
				document.cookie = c
					.replace(/^ +/, '')
					.replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
			});

			localStorage.removeItem('token');
			handleUserMenuClose();
			redirectToLogin();
		} catch (error) {
			console.error('Logout error:', error);
		}
	};

	// Helper function to check if a menu item is active
	const isActive = (path: string) => {
		return location.pathname === path;
	};

	// Navigation to route
	const handleNavigation = (path: string) => {
		navigate(path);
		handleMobileMenuClose();
	};

	// Base navigation items with icons
	const navItems = [
		{
			label: 'Файлы',
			icon: <FolderOutlinedIcon sx={{ mr: 1 }} />,
			path: '/main',
			active: isActive('/main'),
		},
		{
			label: 'Согласования',
			icon: (
				<Badge badgeContent={pendingApprovals} color='error' sx={{ mr: 1 }}>
					<AssignmentTurnedInIcon />
				</Badge>
			),
			path: '/approvals',
			active: isActive('/approvals'),
		},
	];

	// Add Admin section if user has admin role
	if (isAdmin) {
		// Add Approval Editor tab for admins
		navItems.push({
			label: 'Редактор согласования',
			icon: <BuildCircleIcon sx={{ mr: 1 }} />,
			path: '/approval-editor',
			active: isActive('/approval-editor'),
		});

		// Keep Users management as the last tab
		navItems.push({
			label: 'Права и пользователи',
			icon: <PeopleOutlineIcon sx={{ mr: 1 }} />,
			path: '/users',
			active: isActive('/users'),
		});
	}

	return (
<AppBar
    position='static'
    elevation={0}
    sx={{
        backgroundColor:
            theme.palette.mode === 'light'
                ? '#ffffff'
                : alpha(theme.palette.background.paper, 0.9),
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        color: theme.palette.text.primary,
    }}
>
    <Toolbar sx={{ minHeight: 64 }}>
        {/* Логотип и название */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <DesignServicesIcon
                color='primary'
                sx={{
                    mr: 1.5,
                    fontSize: 32,
                    transform: 'rotate(10deg)',
                }}
            />
            <Typography
                variant='h6'
                noWrap
                component='div'
                sx={{
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 700,
                    letterSpacing: '-0.5px',
                    color: theme.palette.primary.main,
                }}
            >
                ConstructHub
            </Typography>

            {/* Бургер-меню (для маленьких экранов) */}
            <IconButton
                size='large'
                edge='start'
                color='inherit'
                aria-label='menu'
                onClick={handleMobileMenuOpen}
                sx={{
                    display: { xs: 'block', md: 'none' },
                    ml: 2,
                    '&:hover': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                }}
            >
                <MenuIcon />
            </IconButton>
        </Box>

        {/* Основное содержимое - кнопки навигации */}
        <Box
            sx={{
                flexGrow: 1,
                display: 'flex',
                justifyContent: 'flex-end', // Выравнивание вправо
                gap: 2, // Отступ между кнопками
                alignItems: 'center',
            }}
        >
            {/* Кнопки навигации для больших экранов */}
            {isLoggedIn && (
                <Box
                    sx={{
                        display: { xs: 'none', md: 'flex' },
                        gap: 2, // Небольшой отступ между кнопками
                    }}
                >
                    {navItems.map(item => (
                        <Button
                            key={item.label}
                            color={item.active ? 'primary' : 'inherit'}
                            startIcon={item.icon}
                            onClick={() => handleNavigation(item.path)}
                            sx={{
                                py: 1.5,
                                px: 3,
                                borderRadius: 50,
                                fontFamily: "'Roboto Mono', monospace",
                                fontWeight: item.active ? 600 : 400,
                                backgroundColor: item.active
                                    ? alpha(theme.palette.primary.main, 0.1)
                                    : 'transparent',
                                '&:hover': {
                                    backgroundColor: item.active
                                        ? alpha(theme.palette.primary.main, 0.15)
                                        : alpha(theme.palette.primary.light, 0.1),
                                },
                                '&::after': item.active
                                    ? {
                                          content: '""',
                                          position: 'absolute',
                                          bottom: 4,
                                          left: '25%',
                                          width: '50%',
                                          height: 2,
                                          borderRadius: 2,
                                          backgroundColor: theme.palette.primary.main,
                                      }
                                    : {},
                            }}
                        >
                            {item.label}
                        </Button>
                    ))}
                </Box>
            )}

            {/* Секция пользователя */}
            {isLoggedIn && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Профиль пользователя */}
                    <Button
                        onClick={handleUserMenuOpen}
                        color='inherit'
                        sx={{
                            borderRadius: 50,
                            textTransform: 'none',
                            px: { xs: 1, sm: 2 },
                            py: 0.5,
                            fontFamily: "'Poppins', sans-serif",
                            '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                            },
                        }}
                        startIcon={
                            <Avatar
                                src={userInfo?.avatar || undefined}
                                sx={{
                                    width: 36,
                                    height: 36,
                                    bgcolor: theme.palette.primary.main,
                                    fontSize: 16,
                                }}
                            >
                                {userInfo?.login?.charAt(0).toUpperCase() || 'U'}
                            </Avatar>
                        }
                    >
                        <Box
                            sx={{
                                display: { xs: 'none', sm: 'block' },
                                textAlign: 'left',
                            }}
                        >
                            <Typography
                                variant='body2'
                                fontWeight={600}
                                noWrap
                                sx={{
                                    fontFamily: "'Poppins', sans-serif",
                                }}
                            >
                                {userInfo?.login || 'User'}
                            </Typography>
                            <Typography
                                variant='caption'
                                color='text.secondary'
                                sx={{
                                    fontFamily: "'Roboto Mono', monospace",
                                }}
                            >
                                {userInfo?.role || 'Role'}
                            </Typography>
                        </Box>
                    </Button>

                    {/* Меню профиля пользователя */}
                    <Menu
                        anchorEl={userMenuAnchor}
                        open={userMenuOpen}
                        onClose={handleUserMenuClose}
                        slotProps={{
                            paper: {
                                elevation: 3,
                                sx: {
                                    mt: 1.5,
                                    overflow: 'visible',
                                    filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.08))',
                                    minWidth: 220,
                                    '&:before': {
                                        content: '""',
                                        display: 'block',
                                        position: 'absolute',
                                        top: 0,
                                        right: 14,
                                        width: 10,
                                        height: 10,
                                        bgcolor: 'background.paper',
                                        transform: 'translateY(-50%) rotate(45deg)',
                                        zIndex: 0,
                                    },
                                },
                            },
                        }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography
                                variant='subtitle1'
                                fontWeight={600}
                                sx={{
                                    fontFamily: "'Poppins', sans-serif",
                                }}
                            >
                                {userInfo?.login || 'User'}
                            </Typography>
                            <Typography
                                variant='body2'
                                color='text.secondary'
                                sx={{
                                    fontFamily: "'Roboto Mono', monospace",
                                }}
                            >
                                {userInfo?.role || 'Role'}
                            </Typography>
                        </Box>
                        <Divider />
                        <MenuItem onClick={handleUserMenuClose} sx={{ py: 1.5 }}>
                            <AccountCircleIcon
                                fontSize='small'
                                sx={{ mr: 2, color: theme.palette.primary.main }}
                            />
                            <Typography
                                variant='body1'
                                sx={{
                                    fontFamily: "'Poppins', sans-serif",
                                }}
                            >
                                Мой профиль
                            </Typography>
                        </MenuItem>
                        <MenuItem onClick={handleLogout} sx={{ py: 1.5 }}>
                            <LogoutOutlinedIcon
                                fontSize='small'
                                sx={{ mr: 2, color: theme.palette.error.main }}
                            />
                            <Typography
                                variant='body1'
                                sx={{
                                    fontFamily: "'Poppins', sans-serif",
                                    color: theme.palette.error.main,
                                }}
                            >
                                Выйти
                            </Typography>
                        </MenuItem>
                    </Menu>

                    {/* Мобильное навигационное меню */}
                    <Menu
                        anchorEl={mobileMenuAnchor}
                        open={mobileMenuOpen}
                        onClose={handleMobileMenuClose}
                        slotProps={{
                            paper: {
                                elevation: 3,
                                sx: {
                                    mt: 1.5,
                                    minWidth: 220,
                                },
                            },
                        }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        {navItems.map(item => (
                            <MenuItem
                                key={item.label}
                                onClick={() => handleNavigation(item.path)}
                                sx={{
                                    py: 1.5,
                                    backgroundColor: item.active
                                        ? alpha(theme.palette.primary.main, 0.08)
                                        : 'transparent',
                                    '&:hover': {
                                        backgroundColor: item.active
                                            ? alpha(theme.palette.primary.main, 0.12)
                                            : alpha(theme.palette.primary.light, 0.08),
                                    },
                                    borderLeft: item.active
                                        ? `3px solid ${theme.palette.primary.main}`
                                        : '3px solid transparent',
                                }}
                            >
                                {React.cloneElement(item.icon, {
                                    fontSize: 'small',
                                    sx: { mr: 2, color: item.active ? 'primary' : 'inherit' },
                                })}
                                <Typography
                                    variant='body1'
                                    color={item.active ? 'primary' : 'inherit'}
                                    fontWeight={item.active ? 600 : 400}
                                    sx={{
                                        fontFamily: "'Poppins', sans-serif",
                                    }}
                                >
                                    {item.label}
                                </Typography>
                            </MenuItem>
                        ))}
                    </Menu>
                </Box>
            )}
        </Box>
    </Toolbar>
</AppBar>
	);
};

export default Header;
