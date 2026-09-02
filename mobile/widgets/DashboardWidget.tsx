import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { WidgetDashboardData } from '../services/widgetData';

function formatShortCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000000) {
    return `₹${(amount / 10000000).toFixed(1)}Cr`;
  }
  if (abs >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`;
  }
  if (abs >= 1000) {
    return `₹${(amount / 1000).toFixed(1)}K`;
  }
  return `₹${amount.toFixed(0)}`;
}

export function renderDashboardWidget(data: WidgetDashboardData) {
  const updatedLabel = new Date(data.updatedAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 'match_parent',
        }}
      >
        <FlexWidget style={{ flexDirection: 'column' }}>
          <TextWidget
            text="My Assistant"
            style={{ fontSize: 14, fontWeight: '700', color: '#f9fafb' }}
          />
          <TextWidget
            text="Dashboard · This Month"
            style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}
          />
        </FlexWidget>
        <FlexWidget
          style={{
            backgroundColor: '#0ea5e9',
            borderRadius: 999,
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
          }}
        >
          <TextWidget
            text={`${data.accountCount} accts`}
            style={{ fontSize: 10, color: '#ffffff', fontWeight: '600' }}
          />
        </FlexWidget>
      </FlexWidget>

      {!data.isLoggedIn ? (
        <FlexWidget style={{ flexDirection: 'column', flexGap: 6 }}>
          <TextWidget
            text="Sign in to view your dashboard"
            style={{ fontSize: 16, fontWeight: '600', color: '#f9fafb' }}
          />
          <TextWidget
            text="Open My Assistant and log in, then refresh the widget."
            style={{ fontSize: 12, color: '#9ca3af' }}
          />
        </FlexWidget>
      ) : (
        <>
          <FlexWidget
            style={{
              backgroundColor: '#0c4a6e',
              borderRadius: 14,
              padding: 14,
              flexDirection: 'column',
              width: 'match_parent',
            }}
          >
            <TextWidget
              text="Total Balance"
              style={{ fontSize: 11, color: '#7dd3fc' }}
            />
            <TextWidget
              text={formatShortCurrency(data.totalBalance)}
              style={{ fontSize: 28, fontWeight: '700', color: '#ffffff', marginTop: 4 }}
            />
          </FlexWidget>

          <FlexWidget
            style={{
              flexDirection: 'row',
              width: 'match_parent',
              flexGap: 10,
            }}
          >
            <FlexWidget
              style={{
                flex: 1,
                backgroundColor: '#14532d',
                borderRadius: 12,
                padding: 12,
                flexDirection: 'column',
              }}
            >
              <TextWidget
                text="Income"
                style={{ fontSize: 10, color: '#86efac' }}
              />
              <TextWidget
                text={formatShortCurrency(data.income)}
                style={{ fontSize: 16, fontWeight: '700', color: '#22c55e', marginTop: 4 }}
              />
            </FlexWidget>

            <FlexWidget
              style={{
                flex: 1,
                backgroundColor: '#450a0a',
                borderRadius: 12,
                padding: 12,
                flexDirection: 'column',
              }}
            >
              <TextWidget
                text="Expense"
                style={{ fontSize: 10, color: '#fca5a5' }}
              />
              <TextWidget
                text={formatShortCurrency(data.expense)}
                style={{ fontSize: 16, fontWeight: '700', color: '#ef4444', marginTop: 4 }}
              />
            </FlexWidget>
          </FlexWidget>

          <FlexWidget
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: 'match_parent',
            }}
          >
            <TextWidget
              text={`Net ${formatShortCurrency(data.net)} · Save ${data.savingsRate.toFixed(0)}%`}
              style={{ fontSize: 12, color: '#e5e7eb', fontWeight: '600' }}
            />
            <TextWidget
              text={updatedLabel}
              style={{ fontSize: 10, color: '#6b7280' }}
            />
          </FlexWidget>
        </>
      )}
    </FlexWidget>
  );
}
