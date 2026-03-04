import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Smartphone, MonitorPlay, ExternalLink, RefreshCw } from "lucide-react";
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';

interface AdminDeviceTrackerProps {
    users: Array<{
        id: string;
        company_name: string | null;
        email: string | null;
        pwa_version?: string;
        last_active_at?: string;
        subscription_status: string;
    }>;
}

export function AdminDeviceTracker({ users }: AdminDeviceTrackerProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const activeUsers = useMemo(() => {
        return users.filter(u => u.last_active_at && differenceInHours(new Date(), new Date(u.last_active_at)) <= 48);
    }, [users]);

    const filteredUsers = useMemo(() => {
        return activeUsers.filter(u =>
            u.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.pwa_version?.toLowerCase().includes(searchTerm.toLowerCase())
        ).sort((a, b) => new Date(b.last_active_at!).getTime() - new Date(a.last_active_at!).getTime());
    }, [activeUsers, searchTerm]);

    const versionStats = useMemo(() => {
        const counts = {} as Record<string, number>;
        activeUsers.forEach(u => {
            const v = u.pwa_version || 'Desconhecida';
            counts[v] = (counts[v] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [activeUsers]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden md:col-span-1">
                    <CardHeader className="p-6">
                        <CardTitle className="flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
                            <MonitorPlay className="text-primary" size={20} />
                            Distribuição de Versões (48h)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 space-y-4">
                        {versionStats.length === 0 && (
                            <p className="text-muted-foreground text-sm">Nenhum dado recente de versão.</p>
                        )}
                        {versionStats.map(([version, count]) => (
                            <div key={version} className="flex justify-between items-center p-3 rounded-xl bg-muted/50">
                                <div className="flex items-center gap-2">
                                    <Badge variant={version === 'Desconhecida' ? 'secondary' : 'default'} className="rounded-lg">
                                        {version}
                                    </Badge>
                                </div>
                                <span className="font-bold text-lg">{count} <span className="text-xs font-normal text-muted-foreground">usuários</span></span>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="bg-white dark:bg-zinc-900 border-none shadow-xl rounded-[2rem] overflow-hidden md:col-span-2">
                    <CardHeader className="p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800">
                        <div>
                            <CardTitle className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">Dispositivos Ativos (Últimas 48h)</CardTitle>
                            <CardDescription>Monitore a versão do app que os usuários estão utilizando.</CardDescription>
                        </div>
                        <Input
                            placeholder="Buscar (Empresa, Versão)..."
                            className="w-full md:w-64 rounded-xl"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="p-6 font-black uppercase text-[10px] tracking-widest">Usuário</TableHead>
                                    <TableHead className="p-6 font-black uppercase text-[10px] tracking-widest text-center">Versão PWA</TableHead>
                                    <TableHead className="p-6 font-black uppercase text-[10px] tracking-widest text-right">Último Acesso</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center p-8 text-muted-foreground">Nenhum dispositivo encontrado nos últimos 2 dias com essa busca.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map(user => (
                                        <TableRow key={user.id} className="hover:bg-muted/20">
                                            <TableCell className="p-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                                                        {user.company_name?.substring(0, 2).toUpperCase() || 'US'}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm leading-tight">{user.company_name || 'Desconhecido'}</div>
                                                        <div className="text-xs text-muted-foreground">{user.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="p-6 text-center">
                                                <Badge variant="outline" className="font-mono text-xs shadow-sm bg-white dark:bg-zinc-950">
                                                    v{user.pwa_version || '?.?.?'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="p-6 text-right">
                                                <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                                                    {formatDistanceToNow(new Date(user.last_active_at!), { addSuffix: true, locale: ptBR })}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
