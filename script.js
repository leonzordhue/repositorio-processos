// Sistema de Gerenciamento de Documentos com Firebase
class DocumentManager {
    constructor() {
        this.documentos = [];
        this.db = firebase.firestore();
        this.storage = firebase.storage();
        this.init();
    }

    async init() {
        try {
            // Testar conexão com Firebase
            await this.db.collection('test').limit(1).get();
            this.updateStatus('✅ Conectado ao Firebase', 'success');
            console.log("✅ Firebase conectado com sucesso!");
        } catch (error) {
            this.updateStatus('❌ Erro no Firebase', 'error');
            console.error("❌ Erro na conexão Firebase:", error);
            return;
        }

        await this.carregarDocumentos();
        this.configurarEventListeners();
        this.atualizarEstatisticas();
    }

    updateStatus(message, type) {
        const statusElement = document.getElementById('statusText');
        statusElement.textContent = message;
        statusElement.style.color = type === 'success' ? '#4caf50' : '#e74c3c';
    }

    async carregarDocumentos() {
        try {
            console.log("📥 Carregando documentos do Firebase...");
            const snapshot = await this.db.collection('documentos').orderBy('dataCriacao', 'desc').get();
            this.documentos = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log(`✅ ${this.documentos.length} documentos carregados do Firebase`);
            this.carregarProcessosNoSelect();
            this.renderizarDocumentos();
        } catch (error) {
            console.error("❌ Erro ao carregar do Firebase:", error);
            this.updateStatus('❌ Erro ao carregar dados', 'error');
            
            // Fallback para localStorage
            this.documentos = JSON.parse(localStorage.getItem('documentosSeinfra')) || [];
            console.log(`📁 ${this.documentos.length} documentos carregados do localStorage`);
            this.renderizarDocumentos();
        }
    }

    configurarEventListeners() {
        // Busca em tempo real
        document.getElementById('searchInput').addEventListener('input', (e) => {
            if (e.target.value.length >= 2) {
                this.realizarBusca(e.target.value);
            } else if (e.target.value.length === 0) {
                this.renderizarDocumentos();
            }
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.realizarBusca(e.target.value);
            }
        });

        // Atualizar estatísticas quando select mudar
        document.getElementById('despachoProcesso').addEventListener('change', () => {
            this.atualizarEstatisticas();
        });
    }

    carregarProcessosNoSelect() {
        const select = document.getElementById('despachoProcesso');
        const currentValue = select.value;
        select.innerHTML = '<option value="">Selecione um processo...</option>';
        
        const processos = this.documentos.filter(doc => doc.tipo === 'processo');
        
        processos.forEach(processo => {
            const option = document.createElement('option');
            option.value = processo.id;
            option.textContent = `${processo.numero} - ${processo.descricao}`;
            select.appendChild(option);
        });

        // Restaurar valor selecionado se existir
        if (currentValue && processos.find(p => p.id === currentValue)) {
            select.value = currentValue;
        }
    }

    async adicionarProcesso() {
        const numero = document.getElementById('processoNumero').value.trim();
        const descricao = document.getElementById('processoDescricao').value.trim();
        const arquivoInput = document.getElementById('processoUpload');

        if (!numero || !descricao || !arquivoInput.files[0]) {
            alert('Por favor, preencha todos os campos do processo.');
            return;
        }

        // Verificar se número já existe
        if (this.documentos.find(doc => doc.numero === numero && doc.tipo === 'processo')) {
            alert('Já existe um processo com este número.');
            return;
        }

        const button = document.querySelector('.pdf-btn');
        const originalText = button.innerHTML;
        
        try {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            button.disabled = true;

            console.log("⬆️ Iniciando upload para Firebase...");
            
            const arquivo = arquivoInput.files[0];
            const fileName = `${numero}_${Date.now()}_${arquivo.name}`;
            const storageRef = this.storage.ref().child(`processos/${fileName}`);
            const snapshot = await storageRef.put(arquivo);
            const downloadURL = await snapshot.ref.getDownloadURL();

            console.log("✅ Arquivo salvo no Storage:", downloadURL);

            const novoProcesso = {
                tipo: 'processo',
                numero: numero,
                descricao: descricao,
                arquivo: {
                    nome: arquivo.name,
                    tipo: arquivo.type,
                    url: downloadURL,
                    nomeArmazenamento: fileName
                },
                dataCriacao: new Date().toISOString(),
                despachos: []
            };

            // Salvar no Firestore
            const docRef = await this.db.collection('documentos').add(novoProcesso);
            novoProcesso.id = docRef.id;
            
            console.log("✅ Processo salvo no Firestore:", docRef.id);
            
            this.documentos.unshift(novoProcesso); // Adicionar no início
            this.carregarProcessosNoSelect();
            this.atualizarEstatisticas();
            this.renderizarDocumentos();
            this.limparFormularioProcesso();
            
            this.updateStatus('✅ Processo adicionado com sucesso!', 'success');
            setTimeout(() => this.updateStatus('✅ Conectado ao Firebase', 'success'), 3000);
            
        } catch (error) {
            console.error("❌ Erro ao adicionar processo:", error);
            alert('Erro ao adicionar processo: ' + error.message);
            this.updateStatus('❌ Erro ao adicionar processo', 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    async adicionarDespacho() {
        const processoId = document.getElementById('despachoProcesso').value;
        const tipo = document.getElementById('despachoTipo').value;
        const arquivoInput = document.getElementById('despachoUpload');

        if (!processoId || !arquivoInput.files[0]) {
            alert('Por favor, selecione um processo e um arquivo.');
            return;
        }

        const processo = this.documentos.find(doc => doc.id === processoId);
        if (!processo) {
            alert('Processo não encontrado.');
            return;
        }

        const button = document.querySelector('.word-btn');
        const originalText = button.innerHTML;
        
        try {
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            button.disabled = true;

            console.log("⬆️ Iniciando upload do despacho...");
            
            const arquivo = arquivoInput.files[0];
            const fileName = `${processo.numero}_${tipo}_${Date.now()}_${arquivo.name}`;
            const storageRef = this.storage.ref().child(`despachos/${fileName}`);
            const snapshot = await storageRef.put(arquivo);
            const downloadURL = await snapshot.ref.getDownloadURL();

            console.log("✅ Despacho salvo no Storage:", downloadURL);

            const novoDespacho = {
                tipo: 'despacho',
                tipoDocumento: tipo,
                processoId: processoId,
                processoNumero: processo.numero,
                arquivo: {
                    nome: arquivo.name,
                    tipo: arquivo.type,
                    url: downloadURL,
                    nomeArmazenamento: fileName
                },
                dataCriacao: new Date().toISOString()
            };

            // Salvar despacho no Firestore
            const docRef = await this.db.collection('documentos').add(novoDespacho);
            novoDespacho.id = docRef.id;

            console.log("✅ Despacho salvo no Firestore:", docRef.id);

            // Atualizar processo para adicionar o despacho
            if (!processo.despachos) processo.despachos = [];
            processo.despachos.push(novoDespacho.id);
            await this.db.collection('documentos').doc(processoId).update({
                despachos: processo.despachos
            });

            this.documentos.unshift(novoDespacho); // Adicionar no início
            this.atualizarEstatisticas();
            this.renderizarDocumentos();
            this.limparFormularioDespacho();
            
            this.updateStatus('✅ Despacho adicionado com sucesso!', 'success');
            setTimeout(() => this.updateStatus('✅ Conectado ao Firebase', 'success'), 3000);
            
        } catch (error) {
            console.error("❌ Erro ao adicionar despacho:", error);
            alert('Erro ao adicionar despacho: ' + error.message);
            this.updateStatus('❌ Erro ao adicionar despacho', 'error');
        } finally {
            button.innerHTML = originalText;
            button.disabled = false;
        }
    }

    realizarBusca(termo) {
        if (!termo.trim()) {
            this.renderizarDocumentos();
            return;
        }

        const searchType = document.getElementById('searchType').value;
        const resultados = this.documentos.filter(doc => {
            const busca = termo.toLowerCase();
            
            switch (searchType) {
                case 'number':
                    return doc.numero.toLowerCase().includes(busca);
                case 'description':
                    return doc.descricao.toLowerCase().includes(busca);
                case 'type':
                    return (doc.tipoDocumento && doc.tipoDocumento.toLowerCase().includes(busca)) ||
                           doc.tipo.toLowerCase().includes(busca);
                default: // all
                    return (
                        doc.numero.toLowerCase().includes(busca) ||
                        doc.descricao.toLowerCase().includes(busca) ||
                        (doc.tipoDocumento && doc.tipoDocumento.toLowerCase().includes(busca)) ||
                        doc.arquivo.nome.toLowerCase().includes(busca)
                    );
            }
        });

        this.renderizarDocumentos(resultados);
    }

    renderizarDocumentos(documentos = null) {
        const grid = document.getElementById('documentsGrid');
        const docsParaRenderizar = documentos || this.documentos;

        if (docsParaRenderizar.length === 0) {
            grid.innerHTML = `
                <div class="no-documents">
                    <i class="fas fa-folder-open"></i>
                    <h3>Nenhum documento encontrado</h3>
                    <p>${documentos ? 'Tente ajustar os termos da busca.' : 'Adicione processos e despachos usando os formulários acima.'}</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = docsParaRenderizar.map(doc => this.criarCardDocumento(doc)).join('');
    }

    criarCardDocumento(doc) {
        const isProcesso = doc.tipo === 'processo';
        const despachosRelacionados = isProcesso ? 
            this.documentos.filter(d => d.processoId === doc.id) : 
            [];

        const dataFormatada = new Date(doc.dataCriacao).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="document-card ${doc.tipo} ${despachosRelacionados.length > 0 ? 'pareado' : ''}">
                <div class="document-header">
                    <span class="document-badge badge-${doc.tipo}">
                        ${isProcesso ? 'PDF' : 'WORD'} - ${isProcesso ? 'PROCESSO' : (doc.tipoDocumento || 'DESPACHO').toUpperCase()}
                    </span>
                    <div class="document-actions">
                        <button class="action-btn btn-view" onclick="documentManager.visualizarDocumento('${doc.id}')" title="Visualizar">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn btn-download" onclick="documentManager.baixarDocumento('${doc.id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn btn-delete" onclick="documentManager.excluirDocumento('${doc.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="document-number">
                    <i class="fas fa-hashtag"></i> ${doc.numero}
                </div>
                
                <div class="document-description">
                    ${doc.descricao}
                </div>
                
                <div class="document-meta">
                    <span><i class="far fa-calendar"></i> ${dataFormatada}</span>
                    <span><i class="far fa-file"></i> ${doc.arquivo.nome}</span>
                </div>

                ${isProcesso && doc.despachos && doc.despachos.length > 0 ? `
                    <div class="document-relationship">
                        <strong><i class="fas fa-link"></i> Documentos Vinculados (${doc.despachos.length}):</strong>
                        ${doc.despachos.slice(0, 3).map(despachoId => {
                            const despacho = this.documentos.find(d => d.id === despachoId);
                            return despacho ? `
                                <div class="relationship-item">
                                    <span>${despacho.tipoDocumento} - ${despacho.arquivo.nome}</span>
                                    <button class="action-btn btn-view" onclick="documentManager.visualizarDocumento('${despacho.id}')">
                                        <i class="fas fa-external-link-alt"></i>
                                    </button>
                                </div>
                            ` : '';
                        }).join('')}
                        ${doc.despachos.length > 3 ? `<div style="text-align: center; color: #666; padding: 5px;">+ ${doc.despachos.length - 3} mais</div>` : ''}
                    </div>
                ` : ''}

                ${!isProcesso ? `
                    <div class="document-relationship">
                        <strong><i class="fas fa-link"></i> Vinculado ao processo:</strong>
                        <div class="relationship-item">
                            <span>${doc.processoNumero}</span>
                            <button class="action-btn btn-view" onclick="documentManager.visualizarProcesso('${doc.processoId}')">
                                <i class="fas fa-external-link-alt"></i>
                            </button>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    visualizarDocumento(id) {
        const doc = this.documentos.find(d => d.id === id);
        if (!doc) return;

        const modal = document.getElementById('documentModal');
        const modalContent = document.getElementById('modalContent');

        const dataFormatada = new Date(doc.dataCriacao).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        modalContent.innerHTML = `
            <h2>${doc.tipo === 'processo' ? '📄 Processo' : '📝 Despacho'} - ${doc.numero}</h2>
            <div class="document-details">
                <p><strong>Descrição:</strong> ${doc.descricao}</p>
                <p><strong>Data de Criação:</strong> ${dataFormatada}</p>
                <p><strong>Arquivo:</strong> ${doc.arquivo.nome}</p>
                <p><strong>Tamanho:</strong> ${this.formatarTamanhoArquivo(doc.arquivo)}</p>
                <p><strong>Armazenamento:</strong> <i class="fas fa-cloud"></i> Firebase Storage</p>
                ${doc.tipo === 'despacho' ? `<p><strong>Tipo de Documento:</strong> ${doc.tipoDocumento}</p>` : ''}
                ${doc.tipo === 'processo' && doc.despachos && doc.despachos.length > 0 ? 
                    `<p><strong>Despachos Vinculados:</strong> ${doc.despachos.length}</p>` : ''}
            </div>
            <div class="modal-actions" style="display: flex; gap: 10px; margin-top: 20px;">
                <button onclick="documentManager.baixarDocumento('${doc.id}')" class="upload-btn pdf-btn" style="flex: 1;">
                    <i class="fas fa-download"></i> Baixar Documento
                </button>
                ${doc.tipo === 'processo' ? `
                    <button onclick="documentManager.visualizarDespachos('${doc.id}')" class="upload-btn word-btn" style="flex: 1;">
                        <i class="fas fa-list"></i> Ver Despachos
                    </button>
                ` : ''}
            </div>
        `;

        modal.style.display = 'block';
    }

    formatarTamanhoArquivo(arquivo) {
        // Esta é uma simulação - em produção, você precisaria obter o tamanho real do arquivo
        return "~1-5 MB"; // Tamanho estimado para documentos
    }

    visualizarProcesso(id) {
        const processo = this.documentos.find(d => d.id === id && d.tipo === 'processo');
        if (processo) {
            this.visualizarDocumento(processo.id);
        }
    }

    visualizarDespachos(processoId) {
        const despachos = this.documentos.filter(d => d.processoId === processoId);
        const modal = document.getElementById('documentModal');
        const modalContent = document.getElementById('modalContent');

        modalContent.innerHTML = `
            <h2>📋 Despachos Vinculados</h2>
            <div class="despachos-list">
                ${despachos.length === 0 ? 
                    '<p>Nenhum despacho vinculado a este processo.</p>' :
                    despachos.map(despacho => `
                        <div class="despacho-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;">
                            <div>
                                <strong>${despacho.tipoDocumento}</strong><br>
                                <span style="color: #666;">${despacho.arquivo.nome}</span>
                            </div>
                            <div style="display: flex; gap: 5px;">
                                <button onclick="documentManager.visualizarDocumento('${despacho.id}')" class="action-btn btn-view">
                                    <i class="fas fa-eye"></i>
                                </button>
                                <button onclick="documentManager.baixarDocumento('${despacho.id}')" class="action-btn btn-download">
                                    <i class="fas fa-download"></i>
                                </button>
                            </div>
                        </div>
                    `).join('')
                }
            </div>
        `;

        modal.style.display = 'block';
    }

    baixarDocumento(id) {
        const doc = this.documentos.find(d => d.id === id);
        if (doc && doc.arquivo.url) {
            const a = document.createElement('a');
            a.href = doc.arquivo.url;
            a.download = doc.arquivo.nome;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('Arquivo não disponível para download.');
        }
    }

    async excluirDocumento(id) {
        if (!confirm('Tem certeza que deseja excluir este documento?\nEsta ação não pode ser desfeita.')) {
            return;
        }

        const docToDelete = this.documentos.find(d => d.id === id);
        
        try {
            // Se for um processo, remover referências nos despachos
            if (docToDelete.tipo === 'processo') {
                const despachos = this.documentos.filter(d => d.processoId === id);
                for (const despacho of despachos) {
                    // Tentar excluir arquivo do Storage
                    try {
                        const storageRef = this.storage.refFromURL(despacho.arquivo.url);
                        await storageRef.delete();
                    } catch (storageError) {
                        console.warn("Não foi possível excluir arquivo do Storage:", storageError);
                    }
                    
                    await this.db.collection('documentos').doc(despacho.id).delete();
                }
            }
            
            // Se for um despacho, remover referência no processo
            if (docToDelete.tipo === 'despacho') {
                const processo = this.documentos.find(d => d.id === docToDelete.processoId);
                if (processo && processo.despachos) {
                    processo.despachos = processo.despachos.filter(dId => dId !== id);
                    await this.db.collection('documentos').doc(processo.id).update({
                        despachos: processo.despachos
                    });
                }
            }

            // Tentar excluir arquivo do Storage
            try {
                const storageRef = this.storage.refFromURL(docToDelete.arquivo.url);
                await storageRef.delete();
            } catch (storageError) {
                console.warn("Não foi possível excluir arquivo do Storage:", storageError);
            }

            // Excluir o documento do Firestore
            await this.db.collection('documentos').doc(id).delete();

            // Remover da lista local
            this.documentos = this.documentos.filter(d => d.id !== id);
            this.carregarProcessosNoSelect();
            this.atualizarEstatisticas();
            this.renderizarDocumentos();
            
            this.updateStatus('✅ Documento excluído com sucesso!', 'success');
            setTimeout(() => this.updateStatus('✅ Conectado ao Firebase', 'success'), 3000);
            
        } catch (error) {
            console.error("Erro ao excluir documento:", error);
            alert('Erro ao excluir documento. Tente novamente.');
            this.updateStatus('❌ Erro ao excluir documento', 'error');
        }
    }

    filterDocuments(filterType) {
        let documentosFiltrados = [];

        switch (filterType) {
            case 'all':
                documentosFiltrados = this.documentos;
                break;
            case 'pareados':
                documentosFiltrados = this.documentos.filter(doc => 
                    doc.tipo === 'processo' && doc.despachos && doc.despachos.length > 0
                );
                break;
            case 'processos':
                documentosFiltrados = this.documentos.filter(doc => doc.tipo === 'processo');
                break;
            case 'despachos':
                documentosFiltrados = this.documentos.filter(doc => doc.tipo === 'despacho');
                break;
        }

        this.renderizarDocumentos(documentosFiltrados);
        
        // Atualizar botões ativos
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }

    atualizarEstatisticas() {
        const totalProcessos = this.documentos.filter(d => d.tipo === 'processo').length;
        const totalDespachos = this.documentos.filter(d => d.tipo === 'despacho').length;
        const totalPareados = this.documentos.filter(d => 
            d.tipo === 'processo' && d.despachos && d.despachos.length > 0
        ).length;
        const totalDocumentos = this.documentos.length;

        document.getElementById('totalProcessos').textContent = totalProcessos;
        document.getElementById('totalDespachos').textContent = totalDespachos;
        document.getElementById('totalPareados').textContent = totalPareados;
        document.getElementById('totalDocumentos').textContent = totalDocumentos;
    }

    limparFormularioProcesso() {
        document.getElementById('processoNumero').value = '';
        document.getElementById('processoDescricao').value = '';
        document.getElementById('processoUpload').value = '';
    }

    limparFormularioDespacho() {
        document.getElementById('despachoProcesso').value = '';
        document.getElementById('despachoTipo').value = 'despacho';
        document.getElementById('despachoUpload').value = '';
    }
}

// Funções globais
function performSearch() {
    const termo = document.getElementById('searchInput').value;
    documentManager.realizarBusca(termo);
}

function clearSearch() {
    document.getElementById('searchInput').value = '';
    documentManager.renderizarDocumentos();
}

function closeModal() {
    document.getElementById('documentModal').style.display = 'none';
}

function adicionarProcesso() {
    documentManager.adicionarProcesso();
}

function adicionarDespacho() {
    documentManager.adicionarDespacho();
}

function filterDocuments(filterType) {
    documentManager.filterDocuments(filterType);
}

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.documentManager = new DocumentManager();
});

// Fechar modal clicando fora dele
window.onclick = function(event) {
    const modal = document.getElementById('documentModal');
    if (event.target === modal) {
        closeModal();
    }
}

// Fechar modal com ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
});
