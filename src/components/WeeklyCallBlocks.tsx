import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  IconButton
} from '@mui/material';
import { ChevronLeft, ChevronRight, Close, Assessment, Upload, Delete } from '@mui/icons-material';

type SDR = 'marine' | 'ludovic' | 'sylvain';

interface Call {
  "Date d'activité": string;
  "Durée": string;
  [key: string]: string;
}

interface CallBlock {
  start: string;
  duration: number;
  calls: number;
  details: Call[];
  sdr: SDR;
}

interface DayBlocks {
  [hour: string]: CallBlock[];
}

interface SDRData {
  [key: string]: CallBlock[];
}

interface Stats {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
}

interface SDRStats {
  [key: string]: Stats;
}

const WeeklyCallBlocks: React.FC = () => {
  const [data, setData] = useState<SDRData>({});
  const [stats, setStats] = useState<SDRStats>({});
  const [currentWeekStart, setCurrentWeekStart] = useState(new Date());
  const [selectedBlock, setSelectedBlock] = useState<CallBlock | null>(null);
  const [showWeekSummary, setShowWeekSummary] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showSDRSelect, setShowSDRSelect] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [currentView, setCurrentView] = useState<'all' | SDR>('all');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function getWeekStart(date: Date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit',
      month: '2-digit'
    });
  };

  const getTimeSlots = () => {
    const slots = [];
    for (let i = 0; i < 24; i++) {
      slots.push(i.toString().padStart(2, '0') + ':00');
    }
    return slots;
  };

  const getDaysOfWeek = () => {
    const days = [];
    for (let i = 0; i < 5; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const previousWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const nextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(currentWeekStart.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setShowSDRSelect(true);
  };

  const handleSDRSelect = async (sdr: SDR) => {
    if (!selectedFile) return;
    setIsImporting(true);
    try {
      const text = await selectedFile.text();
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true
      });

      const processedData = processCallBlocks(result.data as Call[], sdr);
      setData(prev => ({
        ...prev,
        [sdr]: processedData
      }));

      setShowSDRSelect(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error importing file:', error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteSDR = (sdr: SDR) => {
    setData(prev => {
      const newData = { ...prev };
      delete newData[sdr];
      return newData;
    });
    setShowDeleteDialog(false);
  };

  const processCallBlocks = (calls: Call[], sdr: SDR) => {
    const blocks: CallBlock[] = [];
    let currentBlock: Call[] = [];
    
    // Trier les appels par date
    const sortedCalls = [...calls].sort((a, b) => 
      new Date(a["Date d'activité"]).getTime() - new Date(b["Date d'activité"]).getTime()
    );

    // Grouper les appels en blocs
    sortedCalls.forEach((call, index) => {
      if (currentBlock.length === 0) {
        currentBlock.push(call);
      } else {
        const prevTime = new Date(currentBlock[currentBlock.length - 1]["Date d'activité"]).getTime();
        const currentTime = new Date(call["Date d'activité"]).getTime();
        const timeDiff = (currentTime - prevTime) / (1000 * 60); // différence en minutes

        if (timeDiff <= 30) {
          currentBlock.push(call);
        } else {
          // Créer un nouveau bloc avec les appels accumulés
          blocks.push({
            start: currentBlock[0]["Date d'activité"],
            duration: currentBlock.reduce((acc, call) => acc + parseInt(call["Durée"]), 0),
            calls: currentBlock.length,
            details: [...currentBlock],
            sdr,
          });
          currentBlock = [call];
        }
      }
    });

    // Ajouter le dernier bloc s'il existe
    if (currentBlock.length > 0) {
      blocks.push({
        start: currentBlock[0]["Date d'activité"],
        duration: currentBlock.reduce((acc, call) => acc + parseInt(call["Durée"]), 0),
        calls: currentBlock.length,
        details: [...currentBlock],
        sdr,
      });
    }

    return blocks;
  };

  const renderTimeBlocks = () => {
    const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
    const currentDate = new Date(currentWeekStart);
    const workingHours = Array.from({ length: 14 }, (_, i) => i + 8); // 8h à 21h

    // Fonction pour calculer la hauteur et la position du bloc
    const calculateBlockStyle = (block: CallBlock, sdr: string, totalBlocks: number) => {
      const duration = Math.round(block.duration);
      const heightPercentage = Math.min((duration / 60) * 100, 100); // Max 100% pour ne pas déborder
      const topPercentage = ((new Date(block.start).getMinutes()) / 60) * 100;

      const baseStyle = {
        height: `${heightPercentage}%`,
        top: `${topPercentage}%`,
      };

      if (totalBlocks === 1) {
        return {
          ...baseStyle,
          left: '4px',
          right: '4px',
        };
      }

      return sdr === 'marine' 
        ? {
            ...baseStyle,
            left: '4px',
            width: 'calc(50% - 6px)',
          }
        : sdr === 'ludovic'
          ? {
              ...baseStyle,
              left: 'calc(50% + 6px)',
              width: 'calc(50% - 6px)',
            }
          : {
              ...baseStyle,
              right: '4px',
              width: 'calc(50% - 6px)',
            };
    };

    return days.map((day, dayIndex) => {
      const dayDate = new Date(currentDate);
      dayDate.setDate(currentWeekStart.getDate() + dayIndex);
      
      return (
        <div key={day} className="time-column">
          <div className="time-cell">{day} {formatDate(dayDate)}</div>
          {workingHours.map((hour) => {
            const timeSlotStart = new Date(dayDate);
            timeSlotStart.setHours(hour, 0, 0, 0);
            const timeSlotEnd = new Date(timeSlotStart);
            timeSlotEnd.setHours(hour + 1, 0, 0, 0);

            // Créer un objet pour stocker les blocs par SDR
            const sdrBlocks: { [key: string]: CallBlock } = {};
            
            // Regrouper les blocs par SDR
            Object.entries(data).forEach(([sdr, blocks]) => {
              if (currentView !== 'all' && currentView !== sdr) return;
              
              const matchingBlock = blocks?.find(block => {
                const blockStart = block.start;
                const blockDate = new Date(blockStart);
                return blockDate.getDate() === dayDate.getDate() &&
                       blockDate.getMonth() === dayDate.getMonth() &&
                       blockDate.getFullYear() === dayDate.getFullYear() &&
                       blockDate.getHours() === hour;
              });

              if (matchingBlock) {
                sdrBlocks[sdr] = matchingBlock;
              }
            });

            const blockCount = Object.keys(sdrBlocks).length;

            return (
              <div
                key={hour}
                className="time-cell"
                style={{ position: 'relative' }}
              >
                {hour}:00
                {Object.entries(sdrBlocks).map(([sdr, block]) => (
                  <div
                    key={`${sdr}-${block.start}`}
                    className={`time-block ${sdr}`}
                    style={calculateBlockStyle(block, sdr, blockCount)}
                    onClick={() => setSelectedBlock(block)}
                  >
                    <div className="time-block-name">{sdr === 'marine' ? 'Marine' : sdr === 'ludovic' ? 'Ludovic' : 'Sylvain'}</div>
                    <div>{block.calls} appels • {Math.round(block.duration)}min</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      );
    });
  };

  const calculateStats = () => {
    const stats: SDRStats = {};

    // Obtenir les dates de la semaine
    const weekDates = Array.from({ length: 5 }, (_, i) => {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      return date;
    });

    Object.entries(data).forEach(([sdr, blocks]) => {
      if (!blocks) return;
      if (currentView !== 'all' && currentView !== sdr) return;

      const sdrStats = blocks.reduce(
        (acc: Stats, block: CallBlock) => {
          // Vérifier si le bloc est dans la semaine courante
          const blockDate = new Date(block.start);
          const isInCurrentWeek = weekDates.some(date => 
            date.getDate() === blockDate.getDate() &&
            date.getMonth() === blockDate.getMonth() &&
            date.getFullYear() === blockDate.getFullYear()
          );

          if (isInCurrentWeek) {
            acc.totalCalls += block.calls;
            acc.totalDuration += block.duration;
          }
          return acc;
        },
        { totalCalls: 0, totalDuration: 0 }
      );

      if (sdrStats.totalCalls > 0) {
        stats[sdr] = {
          totalCalls: sdrStats.totalCalls,
          totalDuration: sdrStats.totalDuration,
          averageDuration: sdrStats.totalDuration / sdrStats.totalCalls
        };
      }
    });

    return stats;
  };

  const renderStats = () => {
    const stats = calculateStats();
    const activeSDRs = Object.keys(stats);

    if (activeSDRs.length === 0) {
      return <div className="stats-message">Aucune donnée disponible pour cette semaine</div>;
    }

    const weekStart = formatDate(currentWeekStart);
    const weekEnd = formatDate(new Date(currentWeekStart.getTime() + 4 * 24 * 60 * 60 * 1000));

    return (
      <div className="stats-container">
        <div className="stats-header">
          Semaine du {weekStart} au {weekEnd}
        </div>
        {activeSDRs.map(sdr => (
          <div key={sdr} className="stats-section">
            <h3 className="stats-title">{sdr === 'marine' ? 'Marine' : sdr === 'ludovic' ? 'Ludovic' : 'Sylvain'}</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-value">{stats[sdr].totalCalls}</div>
                <div className="stat-label">Appels totaux</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{Math.round(stats[sdr].totalDuration)}</div>
                <div className="stat-label">Minutes totales</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{Math.round(stats[sdr].averageDuration)}</div>
                <div className="stat-label">Minutes/appel</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getBlockColor = (callCount: number) => {
    if (callCount <= 5) return 'green';
    if (callCount <= 10) return 'blue';
    if (callCount <= 15) return 'yellow';
    if (callCount <= 20) return 'orange';
    return 'red';
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/APPEL INTELIGIA - hubspot-crm-exports-appels-enregistres-2025-02-11.csv');
        const csvText = await response.text();
        
        const result = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true
        });

        const processedData = processCallBlocks(result.data as Call[], 'marine');
        setData({ marine: processedData });
      } catch (error) {
        console.error('Error loading CSV:', error);
      }
    };

    fetchData();
  }, []);

  return (
    <div>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5">Planning hebdomadaire des appels</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#f3f4f6', p: 0.5, borderRadius: 2 }}>
              <Button onClick={previousWeek} size="small">
                <ChevronLeft />
              </Button>
              <Typography>Semaine du {formatDate(currentWeekStart)}</Typography>
              <Button onClick={nextWeek} size="small">
                <ChevronRight />
              </Button>
            </Box>
            <Button
              onClick={() => setShowWeekSummary(true)}
              variant="outlined"
              size="small"
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                px: 2,
                py: 1,
              }}
            >
              Récapitulatif
            </Button>
            <ToggleButtonGroup
              value={currentView}
              exclusive
              onChange={(e, value) => value && setCurrentView(value)}
              size="small"
            >
              <ToggleButton value="all" aria-label="all">
                Tous
              </ToggleButton>
              <ToggleButton value="marine" aria-label="marine">
                Marine
              </ToggleButton>
              <ToggleButton value="ludovic" aria-label="ludovic">
                Ludovic
              </ToggleButton>
              <ToggleButton value="sylvain" aria-label="sylvain">
                Sylvain
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#bbf7d0', mr: 1 }} />
            <Typography variant="body2">1-5 appels</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#93c5fd', mr: 1 }} />
            <Typography variant="body2">6-10 appels</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#fde047', mr: 1 }} />
            <Typography variant="body2">11-15 appels</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#fb923c', mr: 1 }} />
            <Typography variant="body2">16-20 appels</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ width: 16, height: 16, bgcolor: '#ef4444', mr: 1 }} />
            <Typography variant="body2">21+ appels</Typography>
          </Box>
        </Box>
      </Box>

      <div className="time-grid">
        {renderTimeBlocks()}
      </div>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileImport}
          style={{ display: 'none' }}
          ref={fileInputRef}
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          variant="contained"
          size="small"
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            px: 3,
            py: 1,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            }
          }}
        >
          {isImporting ? 'Importation en cours...' : 'Importer un fichier CSV'}
        </Button>
        <Button
          onClick={() => setShowDeleteDialog(true)}
          variant="outlined"
          color="error"
          size="small"
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            px: 3,
            py: 1,
          }}
        >
          Supprimer un planning
        </Button>
      </Box>

      <Dialog open={showSDRSelect} onClose={() => setShowSDRSelect(false)}>
        <DialogTitle>Sélectionner le commercial</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Commercial</InputLabel>
            <Select label="Commercial">
              <MenuItem onClick={() => handleSDRSelect('marine')}>Marine</MenuItem>
              <MenuItem onClick={() => handleSDRSelect('ludovic')}>Ludovic</MenuItem>
              <MenuItem onClick={() => handleSDRSelect('sylvain')}>Sylvain</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Supprimer un planning</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Commercial</InputLabel>
            <Select label="Commercial">
              {Object.keys(data).map((sdr) => (
                <MenuItem key={sdr} onClick={() => handleDeleteSDR(sdr as SDR)}>
                  {sdr.charAt(0).toUpperCase() + sdr.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
      </Dialog>

      {selectedBlock && (
        <div className="modal-overlay" onClick={() => setSelectedBlock(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Typography variant="h6">
                Détails du bloc - {formatDate(new Date(selectedBlock.start))}
              </Typography>
              <Button onClick={() => setSelectedBlock(null)} size="small">
                <Close />
              </Button>
            </div>
            <div className="modal-body">
              <div className="details-grid">
                <div className="details-item">
                  <Typography variant="subtitle2">Période :</Typography>
                  <Typography>{formatTime(new Date(selectedBlock.start))} - {formatTime(new Date(selectedBlock.start))}</Typography>
                </div>
                <div className="details-item">
                  <Typography variant="subtitle2">Durée totale :</Typography>
                  <Typography>{Math.round(selectedBlock.duration)} minutes</Typography>
                </div>
                <div className="details-item">
                  <Typography variant="subtitle2">Nombre d'appels :</Typography>
                  <Typography>{selectedBlock.calls}</Typography>
                </div>
                <div className="details-item">
                  <Typography variant="subtitle2">Moyenne :</Typography>
                  <Typography>{Math.round(selectedBlock.duration / selectedBlock.calls)} minutes par appel</Typography>
                </div>
              </div>

              <table className="details-table">
                <thead>
                  <tr>
                    <th>HEURE</th>
                    <th>CONTACT</th>
                    <th>RÉSULTAT</th>
                    <th>NOTES</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBlock.details.map((call, index) => (
                    <tr key={index}>
                      <td>{new Date(call["Date d'activité"]).toLocaleTimeString('fr-FR')}</td>
                      <td>{call["Associated Contact"]}</td>
                      <td>{call["Résultat de l'appel"]}</td>
                      <td>{call["Notes de l'appel"]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showWeekSummary && (
        <div className="modal-overlay" onClick={() => setShowWeekSummary(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <Typography variant="h6">
                Récapitulatif - Semaine du {formatDate(currentWeekStart)}
              </Typography>
              <Button onClick={() => setShowWeekSummary(false)} size="small">
                <Close />
              </Button>
            </div>
            <div className="modal-body">
              {Object.keys(data).length > 0 && renderStats()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyCallBlocks;